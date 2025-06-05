# Ad Performance Data Collection System

This is a web application that allows users to upload video ads along with their dropout graphs. The system saves these files locally on the server.

## Features

- Upload multiple pairs of video ads and dropout graphs
- Files are stored on the server's disk
- Simple and intuitive interface
- Progress indicators for uploads

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ad-performance-data
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/public/uploads/videos` - Directory where uploaded videos are stored
- `/public/uploads/graphs` - Directory where uploaded graphs are stored
- `/data/submissions.json` - JSON file containing metadata about uploads
- `/src/app/api/upload` - API endpoint for file uploads
- `/src/components` - React components

## Data Storage

All files are stored locally on the server:
- Videos are saved to `/public/uploads/videos/`
- Graphs are saved to `/public/uploads/graphs/`
- Metadata is stored in a JSON file at `/data/submissions.json`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
