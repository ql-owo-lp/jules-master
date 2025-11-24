import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nextn.app',
  appName: 'nextn',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // If you are running the backend locally and want to test on an emulator,
    // you can use the IP address of your machine.
    // url: 'http://10.0.2.2:3000',
    // cleartext: true
  }
};

export default config;
