# Jules Hub

Jules Hub is a Next.js application designed to serve as a powerful frontend for managing batch jobs using the Jules API. It integrates modern web technologies to provide a seamless user experience for creating, listing, and managing jobs.

## Goal

The primary goal of this project is to simplify the interaction with the Jules API by providing a user-friendly interface. It allows users to configure their API access, create batch jobs with custom prompts, and automatically generate descriptive titles for these jobs using AI.

## Features

- **API Key Configuration**: Securely input and store your Jules API key. You can use the `JULES_API_KEY` environment variable or configure it directly in the UI (stored in local storage).
- **Batch Job Creation**: Easily create multiple jobs by clicking the "Create New Job" button in the header. The interface supports predefined prompts and history tracking.
- **Job Listing**: View and manage a list of all your created jobs.
- **AI-Powered Title Generation**: Utilizes Genkit (with Google AI) to automatically generate summary titles for your jobs based on the provided prompts.
- **Modern UI**: Built with Next.js, Tailwind CSS, and Radix UI components for a responsive and accessible design.
- **Local Database**: Uses SQLite with Drizzle ORM for robust local data management.

## Configuration

To run the application, you may need to configure the following environment variables. You can create a `.env` file in the root directory.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `JULES_API_KEY` | Your Jules API key for accessing the backend services. | *None* |
| `GOOGLE_GENAI_API_KEY` | API key for Google GenAI (required for AI features). | *None* |
| `DATABASE_URL` | Path to the SQLite database file. | `data/sqlite.db` |

## Documentation

The `docs/` folder contains detailed documentation about the project's design and features:

- [blueprint.md](docs/blueprint.md): detailed overview of the core features, style guidelines, and design philosophy of Jules Hub.

## Getting Started

### Prerequisites

- Node.js (v20 or later recommended)
- npm

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd jules-hub
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  (Optional) Set up environment variables:
    Create a `.env` file and add your keys:
    ```env
    JULES_API_KEY=your_jules_api_key
    GOOGLE_GENAI_API_KEY=your_google_genai_key
    ```

### Running the Application

1.  Start the development server:
    ```bash
    npm run dev
    ```
    The application will be available at [http://localhost:9002](http://localhost:9002).

2.  (Optional) Run Genkit for AI features development:
    ```bash
    npm run genkit:dev
    ```

### Docker

You can also run the application using Docker.

1.  Build the image:
    ```bash
    make build
    ```

2.  Run the container:
    ```bash
    docker run -p 9123:9002 -e JULES_API_KEY=your_key iowoi/jules-master:latest
    ```
