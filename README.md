# ACOT (AI Comments Tool) Chrome Extension

## Overview
ACOT is a Chrome extension that enhances productivity in Google Docs by summarizing comment threads using AI. The extension adds a side panel to Google Docs where users can view AI-generated summaries of comment threads.

## Features
- Summarizes complete comment threads in Google Docs
- Supports multiple AI providers:
  - Google Gemini API
  - Local Ollama endpoints
  - OpenAI-compatible endpoints (like Roxy)
- Customizable prompt templates
- Easy configuration with settings panel

## Installation
1. Download the latest release from the [Releases page](https://github.com/hugozanini/acot)
2. Extract the zip file to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in the top-right corner)
5. Click "Load unpacked" and select the extracted folder

## Configuration
1. Open a Google Docs document
2. Click the ACOT icon in the Chrome toolbar to open the side panel
3. Choose your preferred AI provider:
   - For Gemini: Enter your API key and select a model
   - For Ollama: Enter your endpoint URL (e.g., http://localhost:11434)
   - For OpenAI-compatible endpoints: Enter the endpoint URL and model name
4. Click "Test Connection" to verify your configuration
5. Click "Save Configuration" to save your settings

## Usage
1. Open a Google Docs document with comments
2. Click on any comment in a thread
3. The AI-generated summary will appear in the side panel

## Development
1. Clone the repository: `git clone https://github.com/acot/acot-extension.git`
2. Make your changes
3. Load the unpacked extension in Chrome for testing

## License
MIT
