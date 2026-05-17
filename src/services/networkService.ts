import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  type: string;
};

const mapNetworkState = (state: NetInfoState): NetworkStatus => {
  const isConnected = state.isConnected !== false;
  const isOnline = isConnected && state.isInternetReachable !== false;

  return {
    isConnected,
    isInternetReachable: state.isInternetReachable,
    isOnline,
    type: state.type,
  };
};

class NetworkService {
  async getStatus() {
    return mapNetworkState(await NetInfo.fetch());
  }

  subscribe(listener: (status: NetworkStatus) => void) {
    return NetInfo.addEventListener((state) => {
      listener(mapNetworkState(state));
    });
  }
}

export default new NetworkService();
