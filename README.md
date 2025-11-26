# AI Cycling & Running Plan Generator 🚴‍♂️🏃‍♀️

A smart, AI-powered coaching tool that generates structured training plans for Cyclists and Runners. It uses **Intervals.icu** terminology and logic to create periodized blocks (Build/Recovery) and specific workouts.

## 🌟 Features
- **Dual Sport Support**: Specialized logic for both **Cycling** (Power/TSS) and **Running** (Pace/Distance).
- **Advanced Periodization**: Automatically structures 4-week cycles (3 Build : 1 Recovery).
- **AI Integration**: Uses Gemini or OpenAI to generate detailed workout steps for each session.
- **Smart Progression**:
    - **Cycling**: Increases Long Ride duration and Load (TSS) progressively.
    - **Running**: Increases Mileage and Long Run distance safely.
- **Configuration Storage**: Export/Import your plan settings to share or save setups.
- **Feedback**: Built-in feedback mechanism.

## 🚀 How to Use

### Option 1: The Easiest Way (GitHub Pages)
If you just want to use the tool, go to the live website:
**https://rpkranendonk.github.io/AI-cycing-and-running-plan-generator/**

*(See "How to Enable GitHub Pages" below)*

### Option 2: Run Locally (For Fiddling/Editing)
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RPKranendonk/AI-cycing-and-running-plan-generator.git
    cd AI-cycing-and-running-plan-generator
    ```
2.  **Open `index.html`**:
    - Simply double-click `index.html` to open it in your browser.
    - *Note: Some API features might require a local server due to browser security.*
3.  **Run with Local Server (Recommended)**:
    - If you have Node.js installed:
      ```bash
      npx http-server ./
      ```
    - Then open `http://127.0.0.1:8080` in your browser.

## ⚙️ Setup
1.  Click the **Gear Icon** (top right).
2.  Enter your **Intervals.icu API Key** and **User ID**.
3.  Enter your **Gemini** or **OpenAI** API Key.
4.  Click **Save**.

## 🤝 How to Contribute
1.  Fork this repository.
2.  Make your changes.
3.  Submit a Pull Request!

## 🌐 How to Enable GitHub Pages (For the Owner)
To make this tool accessible to friends via a link:
1.  Go to your repository **Settings**.
2.  Click **Pages** (in the left sidebar).
3.  Under **Build and deployment** > **Branch**, select `main` and `/ (root)`.
4.  Click **Save**.
5.  Wait a minute, and GitHub will give you a live URL (e.g., `https://rpkranendonk.github.io/...`). Share this link with your friends!
