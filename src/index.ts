import * as React from "react";
import {
  IPollingConfig,
  UseOnlineEffectType,
  INetworkInformation,
  TEffectiveType,
  INetworkStatus,
} from "./types";
declare global {
  interface Window {
    _useOnlineEffect_:
      | undefined
      | {
          pingerExist: boolean;
          callbackList: Array<(online: boolean) => void>;
        };
  }
}

const { useEffect, useState } = React;

const UNSUPPORTED_USER_AGENTS_PATTERN =
  /Windows.*Chrome|Windows.*Firefox|Linux.*Chrome/;

const defaultConfig = {
  enabled: true,
  url: "https://ipv4.icanhazip.com/",
  timeout: 5000,
  interval: 5000,
};

class ReactNetworkDetect {
  private static instance: ReactNetworkDetect;
  private intervalId: number | undefined;

  private constructor(public pollingConfigs = defaultConfig) {}

  setIntervalId(intervalId: number | undefined) {
    this.intervalId = intervalId;
  }

  getIntervalId() {
    return this.intervalId;
  }

  static getInstance(pollingConfigs: IPollingConfig | boolean) {
    if (!ReactNetworkDetect.instance) {
      ReactNetworkDetect.instance = new ReactNetworkDetect();
    }

    ReactNetworkDetect.instance.setPollingConfigs(pollingConfigs);
    return ReactNetworkDetect.instance;
  }

  private setPollingConfigs(pollingConfig: IPollingConfig | boolean) {
    const needsPolling = UNSUPPORTED_USER_AGENTS_PATTERN.test(
      navigator?.userAgent
    );

    if (needsPolling) {
      if (typeof pollingConfig === "object") {
        this.pollingConfigs = { ...defaultConfig, ...pollingConfig };
      } else if (pollingConfig) {
        this.pollingConfigs = defaultConfig;
      }
    } else {
      this.pollingConfigs = { ...defaultConfig, enabled: false };
    }
  }

  public ping({
    url,
    timeout,
  }: {
    url: string;
    timeout: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = reject;
      xhr.ontimeout = reject;
      xhr.onreadystatechange = () => {
        if (xhr.readyState === xhr.HEADERS_RECEIVED) {
          if (xhr.status) {
            resolve();
          } else {
            reject();
          }
        }
      };

      xhr.open("HEAD", url);
      xhr.timeout = timeout;
      xhr.send();
    });
  }
}

export const useOnlineEffect: UseOnlineEffectType = (pollingConfigs = true) => {
  const [isOnline, setIsOnline] = useState(true);

  const instance = ReactNetworkDetect.getInstance(pollingConfigs);

  const goOnline = () => {
    setIsOnline(true);
  };

  const goOffline = () => {
    setIsOnline(false);
  };

  useEffect(() => {
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    let intervalId = instance.getIntervalId();
    const { enabled, url, timeout, interval } = instance.pollingConfigs;

    if (enabled && url) {
      if (intervalId) {
        clearInterval(intervalId);
      }

      intervalId = window.setInterval(async () => {
        try {
          await instance.ping({ url, timeout });
          setIsOnline(true);
        } catch (error) {
          setIsOnline(false);
        }
      }, interval);
      instance.setIntervalId(intervalId);
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);

      if (enabled) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return { isOnline };
};

let supported: boolean = false;

const useNetworkStatus = (initialEffectiveConnectionType: TEffectiveType) => {
  supported =
    navigator &&
    "connection" in navigator &&
    "effectiveType" in navigator.connection;

  const initialNetworkStatus = {
    supported,
    effectiveConnectionType: supported
      ? (navigator.connection as INetworkInformation).effectiveType
      : initialEffectiveConnectionType,
  };

  const [networkStatus, updateNetworkStatus] =
    useState<Partial<INetworkStatus>>(initialNetworkStatus);

  const setNetworkStatus = (networkStatus: Partial<INetworkStatus>) => {
    updateNetworkStatus({
      supported,
      ...networkStatus,
    });
  };

  useEffect(() => {
    if (supported) {
      const navigatorConnection = navigator.connection as INetworkInformation;

      const updateECTStatus = () => {
        updateNetworkStatus({
          supported,
          effectiveConnectionType: navigatorConnection.effectiveType,
        });
      };

      navigatorConnection.addEventListener("change", updateECTStatus);
      return () => {
        navigatorConnection.removeEventListener("change", updateECTStatus);
      };
    }
  }, []);

  return { ...networkStatus, setNetworkStatus };
};

export { useNetworkStatus };
