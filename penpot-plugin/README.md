# Penpot Plugin Starter Template

This repository is designed to be your starting point for creating plugins for Penpot. It includes everything you need to get started quickly with development and build processes, so you can focus solely on coding. The template uses Vite as the bundler and comes pre-configured with TypeScript, though you can write your code in vanilla JavaScript if you prefer, while keeping TypeScript to handle Penpot typings in the `plugin.ts` file.

## Pre-requisites

- Node.js and npm (<a href="https://nodejs.org/en/download/package-manager" target="_blank">Download</a>).
- Git (<a href="https://git-scm.com/downloads" target="_blank">Download</a>).
- Visual Studio Code (<a href="https://code.visualstudio.com/download" target="_blank">Download</a>) or similar.
- Basic HTML, CSS and javascript knowledge.

## Folders and Files

- **`/`**: the root directory containing important files like `index.html`, the entry point for your plugin, along with configuration files such as `tsconfig.json` or `package.json`.

- **`public/`**: includes static assets like `manifest.json` for plugin metadata.

- **`src/`**: contains the core source files for your plugin.

- **`node_modules/`**: contains external dependencies used for development, installed via npm.

- **`dist/`**: the output directory generated after the build process, containing the production-ready plugin files for deployment.

### What is typescript?

TypeScript is like JavaScript with extra rules. These rules help you catch mistakes early, before you run your code. It makes your code more reliable and easier to manage, especially in big projects.

We're using TypeScript to make working with the Penpot API easier, as it provides autocompletion and instant access to documentation.

### What are plugin.ts and plugin.js files?

The `plugin.ts` file is where you write code to interact with the Penpot API using TypeScript. This file is then compiled into `plugin.js` which is the final JavaScript code that runs the plugin. You don't write `plugin.js` directly; it's generated from the `plugin.ts` file.

**Note that this is also the only file where you can use the Penpot object.** Do not try to use the Penpot object in your plugin interface scripts.

### What is manifest.json file?

The `manifest.json` file contains the basic information about the plugin. It defines the plugin's name, description, the main code file, and the permissions it requires. The structure of the `manifest.json` file looks like this:

```json
{
  "name": "Your plugin name",
  "description": "Your plugin description",
  "code": "plugin-file.js",
  "icon": "your-icon.png",
  "permissions": [
    "content:read",
    "content:write",
    "library:read",
    "library:write",
    "user:read"
  ]
}
```

This file is essential for the plugin to function correctly within Penpot.

## Getting Started

[![Watch the video how to use starter template](https://penpot.github.io/penpot-plugin-starter-template/plugin-starter-template.png)](https://penpot.github.io/penpot-plugin-starter-template/plugin-starter-template.mp4)

### Use this template

Click the "Use this template" button at the top of the GitHub repository page. That'll create a new repository in your account with all the template files.

Now that your repository was created you can clone it in your machine to start working with it:

```bash
git clone <your-repository-url>
```

### Install Dependencies

After cloning the repository, navigate into the project directory and install the necessary dependencies by running:

```bash
cd <your-project-name>
npm install
```

This command installs all the required packages listed in the `package.json` file.

### Configure the Plugin

Next, you need to edit the plugin's configuration file:

1. Open the `manifest.json` file located in the `/public` folder.
2. Make any necessary changes to your `plugin.ts`file. Note that any modifications to this file require you to restart the development server for changes to take effect. You can check our repository <a href="https://github.com/penpot/penpot-plugins-samples" target="_blank">Penpot plugins samples</a> for specific examples.

### Run the Development Server

To start the development server, run the following command in your terminal:

```bash
npm run dev
```

Once the server is running, open your web browser and go to `http://localhost:4400` to view your plugin in action. Now it is ready to be loaded in Penpot with the url `http://localhost:4400/manifest.json`.

### Load your local plugin

To load and test your local plugin running on `http://localhost:4400`, follow these steps:

1. **Open the Plugin Manager:** Use the shortcut `Ctrl + Alt + P` in any file to open the Plugin Manager modal.

2. **Enter the manifest URL:** In the Plugin Manager, provide the URL for your local plugin's manifest file. For a local setup, this URL will be: `http://localhost:4400/manifest.json`.

3. **Install the plugin:** After entering the URL, Penpot will attempt to install the plugin. If there are no issues, the plugin will be successfully installed.

4. **Access the plugin:** Once installed, you can open and use the plugin directly from within Penpot whenever you need it.

## Development

### Technologies Used

This plugin template uses several key technologies:

- **TypeScript**
- **Vite**
- **Web Components**

### Libraries Included

The template includes two Penpot libraries to assist in your development:

- `@penpot/plugin-styles`: <a href="https://www.npmjs.com/package/@penpot/plugin-styles" target="_blank">This library</a> provides utility functions and resources to help you style your components consistently with Penpot's design system.
- `@penpot/plugin-types`: <a href="https://www.npmjs.com/package/@penpot/plugin-types" target="_blank">This library</a> includes types and API descriptions for interacting with the Penpot plugin API, facilitating the development of plugins that can communicate effectively with the Penpot app.

## Deployment

### Build your plugin

```bash
npm run build
```

### Deploy your plugin

After successfully building your plugin, now you're ready to use your chosen platform to deploy it.

Check our <a href="https://help.penpot.app/plugins/deployment/" target="_blank">Deployment guide</a> for more information about how to deploy your plugin in multiple platforms.
