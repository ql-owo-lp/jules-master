# Jules Master

This is a Next.js application that leverages Genkit for building AI-powered features. It serves as a starter project for building modern web applications with a powerful backend.

## Getting Started

To get the development server running locally, follow these steps:

1.  Install the dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

    The application will be available at [http://localhost:9002](http://localhost:9002).

## Docker

You can also build and run this application using Docker.

### Build the Docker image

To build the Docker image, use the following command:

```bash
make build
```

This will build the image for the current platform.

### Run the Docker container

To run the Docker container, use the following command:

```bash
docker run -p 9123:9002 iowoi/jules-master:latest
```

This will start the application and make it accessible at [http://localhost:9123](http://localhost:9123).
