# Malaiba ES Attendance System

A web-based attendance management system for Malaiba Elementary School, designed to track student attendance and generate monthly reports.

## Features

- **Interactive Attendance Sheet**: A modern user interface to log and edit student attendance.
- **Monthly Reporting**: Automated generation and styling of Excel attendance sheets based on templates.
- **Local Database**: Persistent attendance records stored locally.
- **Dev Server**: A lightweight, native Node.js development server.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/vinzisintheair-create/Malaiba-Attendance.git
   cd Malaiba-Attendance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the local development server:
```bash
npm start
```

Once started, open your web browser and navigate to:
```
http://localhost:8080
```

## Project Structure

- `index.html` - The main user interface for the attendance system.
- `app.js` - Client-side application logic.
- `database.js` - Local database helper methods.
- `styles.css` - Custom styling.
- `server.js` - Local Node.js development server.
- `monthly reporting template.xls` - Excel reporting template.
