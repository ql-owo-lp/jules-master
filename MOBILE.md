# Mobile App Development Guide

This project is configured to support iOS and Android apps using [Capacitor](https://capacitorjs.com).

## Prerequisites

*   **Node.js** (latest LTS recommended)
*   **Capacitor CLI**: Installed as a dependency in the project.
*   **Android Studio**: For Android development.
*   **Xcode**: For iOS development (macOS only).

## Important Note on Database

This application uses `better-sqlite3` and Next.js Server Actions, which require a Node.js runtime.
**The mobile app cannot run the backend logic directly on the device.**

To run the app on a mobile device, you have two options:

### Option 1: Remote Server (Recommended for Production)

1.  Deploy your Next.js application to a hosting provider (e.g., Vercel, AWS, VPS).
2.  Update `capacitor.config.ts` to point to your deployed URL:

    ```typescript
    const config: CapacitorConfig = {
      // ...
      server: {
        url: 'https://your-deployed-app.com',
      }
    };
    ```

3.  Build and sync the app.

### Option 2: Local Development

1.  Start your local Next.js server:
    ```bash
    npm run dev
    ```
2.  Find your computer's local IP address (e.g., `192.168.1.5`).
3.  Update `capacitor.config.ts` to point to your local server:

    ```typescript
    const config: CapacitorConfig = {
      // ...
      server: {
        url: 'http://192.168.1.5:3000', // Replace with your IP
        cleartext: true
      }
    };
    ```
    *Note: `cleartext: true` allows http connections on Android.*

## Building the App

1.  **Sync Capacitor Config:**
    Every time you change `capacitor.config.ts` or install a new plugin, run:
    ```bash
    npm run cap:sync
    ```

2.  **Add Platforms (First time only):**
    ```bash
    npx cap add android
    npx cap add ios
    ```

3.  **Open Native IDE:**
    ```bash
    npm run cap:open:android
    # or
    npm run cap:open:ios
    ```

4.  **Run on Emulator/Device:**
    Use Android Studio or Xcode to run the application on your connected device or emulator.

## Project Structure

*   `capacitor.config.ts`: Main configuration file for Capacitor.
*   `android/`: Generated Android project (after running `npx cap add android`).
*   `ios/`: Generated iOS project (after running `npx cap add ios`).

## Limitations

*   **Offline Support**: Since the database lives on the server, the app requires an internet connection to function (unless you refactor the app to use a local SQLite plugin and sync with the server).
