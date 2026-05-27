#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { spawn, exec } from "child_process";
import { homedir } from "os";
import { promisify } from "util";
import * as http from "http";
import axios from "axios";
import { DASHBOARD_HTML } from "./dashboardHtml";

const execPromise = promisify(exec);

const PORT = 3024;
const UNITY_URL = `http://localhost:${PORT}`;

// Colors
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const cyan = "\x1b[36m";

function getClaudeConfigPath(): string {
  const home = homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Claude",
      "claude_desktop_config.json"
    );
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else {
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function getCursorConfigPath(): string {
  const home = homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "storage.json");
  } else {
    return path.join(home, ".config", "Cursor", "User", "globalStorage", "storage.json");
  }
}

function getWindsurfConfigPath(): string {
  const home = homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.USERPROFILE || home,
      ".codeium",
      "windsurf",
      "mcp_config.json"
    );
  } else {
    return path.join(home, ".codeium", "windsurf", "mcp_config.json");
  }
}

function getClineConfigPath(): string {
  const home = homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Code",
      "User",
      "globalStorage",
      "saoudrizwan.claude-dev",
      "settings",
      "cline_mcp_settings.json"
    );
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
  } else {
    return path.join(home, ".config", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
  }
}

function configureMcpInFile(configPath: string, type: 'claude' | 'cursor' | 'windsurf' | 'cline') {
  const configDir = path.dirname(configPath);
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf8");
      try {
        config = JSON.parse(content);
      } catch (e) {
        console.warn(`${yellow}⚠ Could not parse existing config at ${configPath}. Creating new one.${reset}`);
      }
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const cliPath = path.resolve(__dirname, "index.js");

    if (type === 'cursor') {
      config.mcpServers["unity-ecosystem"] = {
        name: "unity-ecosystem",
        type: "stdio",
        command: "node",
        args: [cliPath, "start"],
        isEnabled: true
      };
    } else if (type === 'cline') {
      config.mcpServers["unity-ecosystem"] = {
        command: "node",
        args: [cliPath, "start"],
        disabled: false
      };
    } else {
      config.mcpServers["unity-ecosystem"] = {
        command: "node",
        args: [cliPath, "start"]
      };
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.log(`${green}✔ Successfully configured ${bold}${type}${reset} mcp server.`);
  } catch (error: any) {
    console.warn(`${red}✖ Failed to configure ${type}: ${error.message}${reset}`);
  }
}

function printHelp() {
  console.log(`
${bold}${cyan}Unity AI Ecosystem CLI${reset}
Usage: ${bold}unity-ai <command> [args]${reset}

Commands:
  ${bold}init <project-path> [--upm]${reset} Install the Unity C# Editor plugin into an existing Unity project.
  ${bold}doctor${reset}                      Diagnose connection status with the running Unity Editor.
  ${bold}configure${reset}                   Automatically configure Claude, Cursor, Windsurf, and Cline.
  ${bold}dashboard${reset}                   Start the interactive local Web Dashboard (port 3025).
  ${bold}start${reset}                       Start the Unity MCP Server (runs via stdio).
  ${bold}help${reset}                        Display this help menu.
`);
}

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function handleInit(projectPath?: string, useUpm?: boolean) {
  if (!projectPath) {
    console.error(`${red}Error: Please specify the path to your Unity project.${reset}`);
    console.log("Usage: unity-ai init <path-to-unity-project> [--upm]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(projectPath);
  const assetsPath = path.join(resolvedPath, "Assets");

  if (!fs.existsSync(assetsPath)) {
    console.error(`${red}Error: Directory "${resolvedPath}" does not appear to be a valid Unity project (no "Assets" folder found).${reset}`);
    process.exit(1);
  }

  const cliDir = __dirname;
  const possiblePaths = [
    path.join(cliDir, "../../unity-plugin"),
    path.join(cliDir, "../unity-plugin"),
    path.join(cliDir, "../packages/unity-plugin")
  ];

  let pluginDir = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "package.json"))) {
      pluginDir = path.resolve(p);
      break;
    }
  }

  if (!pluginDir) {
    console.error(`${red}Error: Could not locate the unity-plugin package directory.${reset}`);
    process.exit(1);
  }

  if (useUpm) {
    const manifestPath = path.join(resolvedPath, "Packages", "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.error(`${red}Error: Could not find Packages/manifest.json at: ${manifestPath}${reset}`);
      process.exit(1);
    }

    try {
      const destPackageDir = path.join(resolvedPath, "Packages", "com.unityai.core");
      if (fs.existsSync(destPackageDir)) {
        fs.rmSync(destPackageDir, { recursive: true, force: true });
      }

      copyDirSync(pluginDir, destPackageDir);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!manifest.dependencies) {
        manifest.dependencies = {};
      }

      manifest.dependencies["com.unityai.core"] = "file:com.unityai.core";

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
      console.log(`
${green}Success!${reset} Programmatically installed Unity plugin as a local UPM package.
Created package folder: ${bold}${destPackageDir}${reset}
Modified: ${bold}${manifestPath}${reset}
Added Dependency: ${cyan}"com.unityai.core": "file:com.unityai.core"${reset}

${yellow}Next Steps:${reset}
1. Open your project in Unity.
2. Unity Package Manager will automatically import the local package.
3. The server starts automatically on port 3024.
4. Run ${bold}unity-ai doctor${reset} to verify connection!
`);
    } catch (error: any) {
      console.error(`${red}Error writing to Packages/manifest.json: ${error.message}${reset}`);
      process.exit(1);
    }
  } else {
    // Copy file directly to Assets (copy mode)
    const sourceFile = path.join(pluginDir, "Editor/UnityAIServer.cs");
    if (!fs.existsSync(sourceFile)) {
      console.error(`${red}Error: Could not find C# source file at: ${sourceFile}${reset}`);
      process.exit(1);
    }

    const destDir = path.join(assetsPath, "Plugins", "UnityAI", "Editor");
    const destFile = path.join(destDir, "UnityAIServer.cs");

    try {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourceFile, destFile);
      console.log(`
${green}Success!${reset} Installed Unity C# Plugin (Loose File Mode).
Created: ${bold}${destFile}${reset}

${yellow}Next Steps:${reset}
1. Open your project in Unity.
2. Unity will compile the new script.
3. Start the server via menu: ${bold}Tools > Unity AI > Start Server${reset}.
4. Run ${bold}unity-ai doctor${reset} to verify connection!
`);
    } catch (error: any) {
      console.error(`${red}Error copying plugin file: ${error.message}${reset}`);
      process.exit(1);
    }
  }
}

async function handleConfigure() {
  console.log(`${cyan}Running auto-configuration for AI agents...${reset}`);

  // 1. Claude Desktop
  const claudePath = getClaudeConfigPath();
  configureMcpInFile(claudePath, "claude");

  // 2. Cursor
  const cursorPath = getCursorConfigPath();
  configureMcpInFile(cursorPath, "cursor");

  // 3. Windsurf
  const windsurfPath = getWindsurfConfigPath();
  configureMcpInFile(windsurfPath, "windsurf");

  // 4. VS Code Cline
  const clinePath = getClineConfigPath();
  configureMcpInFile(clinePath, "cline");

  console.log(`
${green}Success!${reset} Configuration completed.

${yellow}Next Steps:${reset}
1. Restart your AI Agent client (Claude Desktop, Cursor, Windsurf, or VS Code).
2. Open your Unity project.
3. Start coding with your Unity AI Assistant!
`);
}

async function handleDoctor() {
  console.log(`${cyan}Running diagnostics...${reset}`);
  console.log(`Pinging Unity Editor plugin on port ${PORT}...`);

  try {
    const response = await axios.post(
      UNITY_URL,
      { action: "ping" },
      { timeout: 3000 }
    );

    if (response.data && response.data.success) {
      const data = response.data;
      console.log(`
${green}● Connected to Unity Editor!${reset}
----------------------------------------
Unity Version:   ${bold}${data.unityVersion}${reset}
Platform:        ${bold}${data.platform}${reset}
Project Path:    ${bold}${data.projectPath}${reset}
Active Scene:    ${bold}${data.activeScene}${reset}
Play Mode:       ${bold}${data.isPlaying ? "Playing" : "Stopped"}${reset}
Compile Status:  ${bold}${data.isCompiling ? "Compiling..." : "Idle"}${reset}
Selected Object: ${bold}${data.selectedObjectName || "None"} (ID: ${data.selectedObjectId})${reset}
----------------------------------------
Ecosystem is ${bold}${green}FULLY FUNCTIONAL${reset} and ready.
`);
    } else {
      console.log(`
${yellow}⚠ Connected to port ${PORT}, but received unexpected response:${reset}
${JSON.stringify(response.data, null, 2)}
`);
    }
  } catch (error: any) {
    console.log(`
${red}✖ Connection failed.${reset}
Could not connect to the Unity Editor on port ${PORT}.

${bold}Troubleshooting checklist:${reset}
1. Is the Unity Editor running?
2. Did you run ${bold}unity-ai init <project-path>${reset} to copy the plugin into your project?
3. Check the Unity console for compilation errors.
4. Verify if the server is started in Unity: ${bold}Tools > Unity AI > Start Server${reset}.
`);
  }
}

function handleStart() {
  let serverPath = "";

  try {
    // Try resolving via standard Node package resolution (for global/npx runs)
    serverPath = require.resolve("unity-mcp-server");
  } catch (e) {
    // Fall back to relative path check (for local development workspace)
    const cliDir = __dirname;
    const possibleServerPaths = [
      path.join(cliDir, "../../mcp-server/dist/index.js"),
      path.join(cliDir, "../mcp-server/dist/index.js"),
      path.join(cliDir, "../packages/mcp-server/dist/index.js")
    ];

    for (const p of possibleServerPaths) {
      if (fs.existsSync(p)) {
        serverPath = p;
        break;
      }
    }
  }

  if (!serverPath) {
    console.error(`${red}Error: Could not locate compiled MCP server (unity-mcp-server).${reset}`);
    console.log(`Please run ${bold}npm run build${reset} in the ecosystem workspace first.`);
    process.exit(1);
  }

  const child = spawn("node", [serverPath], {
    stdio: ["inherit", "pipe", "inherit"]
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
    process.exit(0);
  });
}

async function runAdb(args: string): Promise<string> {
  try {
    const { stdout } = await execPromise(`adb ${args}`);
    return stdout;
  } catch (error: any) {
    throw new Error(`ADB failed: ${error.message}`);
  }
}

async function handleDashboard() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(DASHBOARD_HTML);
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          if (req.url === "/api/adb/devices") {
            const stdout = await runAdb("devices");
            const lines = stdout.split("\n").filter(l => l.trim() && !l.startsWith("List of"));
            const devices = lines.map(line => {
              const parts = line.split("\t");
              return { id: parts[0].trim(), state: parts[1] ? parts[1].trim() : "unknown" };
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, devices }));
          } else if (req.url === "/api/adb/screenshot") {
            const tmpPath = path.join(homedir(), "quest_dashboard_shot.png");
            await runAdb("shell screencap -p /sdcard/quest_dash_shot.png");
            await runAdb(`pull /sdcard/quest_dash_shot.png "${tmpPath}"`);
            
            if (fs.existsSync(tmpPath)) {
              const base64Image = fs.readFileSync(tmpPath, "base64");
              fs.unlinkSync(tmpPath);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true, image: base64Image }));
            } else {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, error: "Screenshot file not pulled successfully" }));
            }
          } else if (req.url === "/api/adb/install") {
            const buildDirs = ["Builds/Android", "Builds/ActiveTarget", "Builds"];
            let foundApk = "";
            for (const dir of buildDirs) {
              const fullDir = path.resolve(process.cwd(), dir);
              if (fs.existsSync(fullDir)) {
                const files = fs.readdirSync(fullDir);
                const apkFile = files.find(f => f.endsWith(".apk"));
                if (apkFile) {
                  foundApk = path.join(fullDir, apkFile);
                  break;
                }
              }
            }

            if (!foundApk) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, error: "No compiled APK file found in Builds/ directories." }));
              return;
            }

            const stdout = await runAdb(`install -r "${foundApk}"`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, stdout }));
          } else if (req.url === "/api/adb/launch") {
            let pkgName = "com.unity3d.player";
            try {
              const settingsPath = path.resolve(process.cwd(), "ProjectSettings/ProjectSettings.asset");
              if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, "utf8");
                const match = content.match(/bundleIdentifier:\s*(.*)/);
                if (match && match[1]) {
                  pkgName = match[1].trim().replace(/['"]/g, "");
                }
                const androidMatch = content.match(/Android:\s*(.*)/);
                if (androidMatch && androidMatch[1]) {
                  pkgName = androidMatch[1].trim().replace(/['"]/g, "");
                }
              }
            } catch (e) {}

            const stdout = await runAdb(`shell am start -n ${pkgName}/com.unity3d.player.UnityPlayerActivity`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, stdout }));
          } else if (req.url === "/api/adb/logs") {
            const stdout = await runAdb("logcat -d -t 100 -s Unity");
            const logs = stdout.split("\n").filter(l => l.trim());
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, logs }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not Found" }));
          }
        } catch (error: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(3025, () => {
    console.log(`
${bold}${green}Unity AI Web Dashboard running!${reset}
Open in browser: ${bold}${cyan}http://localhost:3025${reset}

Connecting to Unity Editor on port 3024...
Press ${bold}Ctrl+C${reset} to stop the dashboard server.
`);
  });
}

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init": {
      const useUpm = args.includes("--upm");
      const projectPathArg = args.slice(1).find(arg => !arg.startsWith("-"));
      await handleInit(projectPathArg, useUpm);
      break;
    }
    case "doctor":
      await handleDoctor();
      break;
    case "configure":
      await handleConfigure();
      break;
    case "dashboard":
      await handleDashboard();
      break;
    case "start":
      handleStart();
      break;
    case "help":
    case "-h":
    case "--help":
      printHelp();
      break;
    default:
      if (command) {
        console.error(`${red}Unknown command: "${command}"${reset}`);
      }
      printHelp();
      break;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
