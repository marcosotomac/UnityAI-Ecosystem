import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

const UNITY_PORT = 3024;
const UNITY_URL = `http://localhost:${UNITY_PORT}`;

// Helper to run ADB command
async function runAdbCommand(args: string): Promise<string> {
  try {
    const { stdout } = await execPromise(`adb ${args}`);
    return stdout;
  } catch (error: any) {
    throw new Error(
      `ADB command failed: ${error.message}. Please ensure Android Platform Tools (adb) are installed and added to your system PATH.`
    );
  }
}

// Helper to make API calls to Unity plugin
async function callUnityPlugin(action: string, params: Record<string, any> = {}): Promise<any> {
  try {
    const response = await axios.post(
      UNITY_URL,
      { action, ...params },
      { timeout: 180000 }
    );
    return response.data;
  } catch (error: any) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        "Could not connect to Unity Editor. Please ensure Unity is running and the UnityAIServer plugin is started (Window > Tools > Unity AI > Start Server)."
      );
    }
    throw new Error(`Unity AI Plugin error: ${error.message}`);
  }
}

// Helper to recursively list files (for find_assets)
function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (
      file === "Library" ||
      file === "Temp" ||
      file === "Logs" ||
      file === "UserSettings" ||
      file === "obj" ||
      file === "node_modules" ||
      file === ".git"
    ) {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const server = new Server(
  {
    name: "unity-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "unity_ping",
        description: "Checks connection to Unity Editor, returns Unity version, play mode state, active scene name, current editor selection, and project path.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_scene_hierarchy",
        description: "Retrieves the hierarchy of GameObjects in the currently active scene, including tags, layers, transforms, and component names.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_gameobject_details",
        description: "Retrieves detailed information for a specific GameObject by its Instance ID, including all components, their serializable fields, properties, and values.",
        inputSchema: {
          type: "object",
          properties: {
            instanceId: { type: "number", description: "The instance ID of the GameObject." }
          },
          required: ["instanceId"]
        }
      },
      {
        name: "unity_create_gameobject",
        description: "Creates a new GameObject in the scene hierarchy. Can optionally specify a parent GameObject, components to add, or instantiate a Prefab by asset path.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the GameObject." },
            parentId: { type: "number", description: "Instance ID of the parent GameObject (0 or omit for root)." },
            components: { type: "string", description: "Comma-separated list of component names to add (e.g. 'BoxCollider, Rigidbody'). Only applied if not instantiating a prefab." },
            prefabPath: { type: "string", description: "Optional project-relative path to a Prefab asset to instantiate (e.g., 'Assets/Prefabs/Player.prefab')." }
          },
          required: ["name"]
        }
      },
      {
        name: "unity_delete_gameobject",
        description: "Deletes a GameObject by its Instance ID.",
        inputSchema: {
          type: "object",
          properties: {
            instanceId: { type: "number", description: "The instance ID of the GameObject." }
          },
          required: ["instanceId"]
        }
      },
      {
        name: "unity_update_component",
        description: "Modifies the value of a field or property on a GameObject's component. Supports primitives, Vectors, and Colors.",
        inputSchema: {
          type: "object",
          properties: {
            instanceId: { type: "number", description: "GameObject Instance ID." },
            componentType: { type: "string", description: "Class name of the component (e.g., 'Transform', 'Light')." },
            fieldName: { type: "string", description: "Name of the field or property to modify." },
            fieldValue: { type: "string", description: "New value (e.g., '12.5', 'true', '(1.0, 2.0, 3.0)', '#FF0000')." }
          },
          required: ["instanceId", "componentType", "fieldName", "fieldValue"]
        }
      },
      {
        name: "unity_select_gameobject",
        description: "Selects a GameObject in the Unity Editor hierarchy. Optionally centers the editor viewport camera to focus on this GameObject.",
        inputSchema: {
          type: "object",
          properties: {
            instanceId: { type: "number", description: "The instance ID of the GameObject to select." },
            focus: { type: "boolean", description: "Set true to automatically frame/focus the Editor camera on this object." }
          },
          required: ["instanceId"]
        }
      },
      {
        name: "unity_control_playmode",
        description: "Controls Unity Play Mode (starts, pauses, or stops the game).",
        inputSchema: {
          type: "object",
          properties: {
            state: { type: "string", enum: ["play", "pause", "stop"], description: "Desired playmode state." }
          },
          required: ["state"]
        }
      },
      {
        name: "unity_get_logs",
        description: "Retrieves the last 100 console logs (Log, Warning, Error) from the Unity Editor console.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_clear_logs",
        description: "Clears the active logs inside the Unity Editor Console.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_compiler_errors",
        description: "Retrieves any active C# compile-time errors in the Unity project.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_project_context",
        description: "Exposes project settings including color space, active build targets, scripting backends, tags, layers, and the list of active manifest packages.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_project_map",
        description: "Generates a structured map of all Scenes, Prefabs, Scripts, and Assembly Definitions in the project for holistic planning.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_run_tests",
        description: "Runs all EditMode and PlayMode unit tests configured in the project using Unity's Test Framework and returns their pass/fail results.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_performance_metrics",
        description: "Gathers memory heap statistics, graphics card memory, frame count, and running status to diagnose performance or leak issues.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_get_profiler_report",
        description: "Generates a detailed sliding-window profiler report with average FPS, min/max frame rate, and garbage collection (GC) allocation statistics.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_build_project",
        description: "Triggers a full player compilation and game build for the active platform target (Switch to Android target builds an APK for Oculus Quest).",
        inputSchema: {
          type: "object",
          properties: {
            outputPath: { type: "string", description: "Optional project-relative folder to build the binary into (defaults to 'Builds/ActiveTarget')." }
          }
        }
      },
      {
        name: "unity_build_and_archive",
        description: "Compiles the active platform build player and compresses the resulting folder into a single ZIP file for CI/CD distribution.",
        inputSchema: {
          type: "object",
          properties: {
            outputPath: { type: "string", description: "Optional project-relative folder to build the binary into (defaults to 'Builds/ActiveTarget')." }
          }
        }
      },
      {
        name: "unity_install_package",
        description: "Installs a package programmatically in the Unity Editor Package Manager (e.g. 'com.unity.inputsystem', 'com.unity.cinemachine').",
        inputSchema: {
          type: "object",
          properties: {
            packageName: { type: "string", description: "Name of the package to install." }
          },
          required: ["packageName"]
        }
      },
      {
        name: "unity_create_script",
        description: "Generates a new C# script directly in the project Assets directory and triggers an Asset database compilation.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the class/script (e.g., 'GameManager'). Do not append '.cs'." },
            code: { type: "string", description: "The C# script body code. If omitted, generates a standard MonoBehaviour template." }
          },
          required: ["name"]
        }
      },
      {
        name: "unity_create_shader",
        description: "Generates a standard Surface ShaderLab shader file (.shader) directly inside the project Assets folder.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the shader (e.g., 'Hologram'). Do not append '.shader'." },
            code: { type: "string", description: "The ShaderLab code content. If omitted, generates a standard albedo template." }
          },
          required: ["name"]
        }
      },
      {
        name: "unity_import_asset",
        description: "Copies a local asset file from the workspace (like generated textures or models) directly into the Unity project Assets hierarchy.",
        inputSchema: {
          type: "object",
          properties: {
            sourcePath: { type: "string", description: "Absolute or relative path of the source file on disk." },
            targetPath: { type: "string", description: "Project-relative path inside the Assets folder to import into (e.g., 'Assets/Textures/PlayerSkin.png')." }
          },
          required: ["sourcePath", "targetPath"]
        }
      },
      {
        name: "unity_capture_viewport",
        description: "Captures a screenshot of the last active Scene View in the Unity Editor and returns it as a Base64-encoded PNG image.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_create_animator_state",
        description: "Programmatically adds a new animation state to an Animator Controller. Automatically creates the controller asset if it doesn't exist.",
        inputSchema: {
          type: "object",
          properties: {
            controllerPath: { type: "string", description: "Project-relative path of the Animator Controller (e.g. 'Assets/Animations/PlayerController.controller')." },
            stateName: { type: "string", description: "Name of the state to add (e.g. 'Jump')." },
            clipPath: { type: "string", description: "Optional project-relative path to the Animation Clip asset to bind to this state." }
          },
          required: ["controllerPath", "stateName"]
        }
      },
      {
        name: "unity_extract_localization",
        description: "Scans C# scripts in the project to extract hardcoded strings, saving them into 'Assets/localization_extract.json' for translation.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_verify_meta_files",
        description: "Scans the Assets directory to ensure all assets have matching .meta files. Re-compiles databases to fix any missing metas.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_create_custom_inspector",
        description: "Generates a C# Custom Editor Inspector script with template buttons and GUI utilities inside the Editor/ folder.",
        inputSchema: {
          type: "object",
          properties: {
            targetClass: { type: "string", description: "Name of the target C# MonoBehaviour class to customize (e.g., 'PlayerController')." },
            inspectorName: { type: "string", description: "Name of the generated Inspector class (e.g., 'PlayerControllerEditor')." }
          },
          required: ["targetClass", "inspectorName"]
        }
      },
      {
        name: "unity_quest_devices",
        description: "Lists all connected Android/Meta Quest VR devices via ADB.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_quest_install",
        description: "Installs a compiled APK package on the connected Meta Quest headset via ADB.",
        inputSchema: {
          type: "object",
          properties: {
            apkPath: { type: "string", description: "Absolute or project-relative path to the compiled Android APK file (e.g. 'Builds/Android/Game.apk')." }
          },
          required: ["apkPath"]
        }
      },
      {
        name: "unity_quest_launch",
        description: "Launches the installed app on the Meta Quest headset via ADB.",
        inputSchema: {
          type: "object",
          properties: {
            packageName: { type: "string", description: "The Android package name configured in PlayerSettings (e.g., 'com.MyCompany.VRGame')." }
          },
          required: ["packageName"]
        }
      },
      {
        name: "unity_quest_logs",
        description: "Streams recent debug logcat outputs from the connected Quest headset filtered by Unity messages.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "unity_quest_screenshot",
        description: "Captures a high-resolution screenshot from the connected Quest headset display and pulls it locally into the workspace.",
        inputSchema: {
          type: "object",
          properties: {
            localPath: { type: "string", description: "Local path inside workspace to save the PNG screenshot (e.g., 'quest_screenshot.png')." }
          },
          required: ["localPath"]
        }
      },
      {
        name: "unity_execute_script",
        description: "Compiles and executes an arbitrary C# code snippet inside the Unity Editor on the main thread. Must end with a return statement yielding a string. Very powerful for editor scripts.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "The C# code body to run. Must return a string." }
          },
          required: ["code"]
        }
      },
      {
        name: "unity_find_assets",
        description: "Searches for assets (scripts, prefabs, scenes, textures) within the local workspace directory structure (offline-compatible).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query to filter asset filenames." },
            extension: { type: "string", description: "Specific extension to filter by (e.g. 'cs', 'prefab', 'unity')." }
          },
          required: ["query"]
        }
      },
      {
        name: "unity_search_assets",
        description: "Queries Unity's native AssetDatabase to find assets by filter (e.g. 't:Prefab Player', 't:Material', 't:Script').",
        inputSchema: {
          type: "object",
          properties: {
            filter: { type: "string", description: "The native AssetDatabase search filter (e.g., 't:Prefab name', 't:Texture2D')." }
          },
          required: ["filter"]
        }
      },
      {
        name: "unity_bind_script_component",
        description: "Programmatically attaches a C# component script to a GameObject in the scene hierarchy by its class name.",
        inputSchema: {
          type: "object",
          properties: {
            instanceId: { type: "number", description: "The instance ID of the target GameObject." },
            className: { type: "string", description: "The name of the C# MonoBehaviour class to attach." }
          },
          required: ["instanceId", "className"]
        }
      },
      {
        name: "unity_autofix_compiler_errors",
        description: "Queries active Unity compilation errors, extracts code snippets from the offending source files, and returns detailed troubleshooting context for self-healing repair.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "unity_ping": {
        const data = await callUnityPlugin("ping");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_scene_hierarchy": {
        const data = await callUnityPlugin("get_hierarchy");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_gameobject_details": {
        const instanceId = args?.instanceId as number;
        const data = await callUnityPlugin("get_details", { instanceId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_create_gameobject": {
        const nameVal = args?.name as string;
        const parentId = (args?.parentId as number) || 0;
        const components = (args?.components as string) || "";
        const prefabPath = (args?.prefabPath as string) || "";
        const data = await callUnityPlugin("create_object", { name: nameVal, parentId, componentType: components, prefabPath });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_delete_gameobject": {
        const instanceId = args?.instanceId as number;
        const data = await callUnityPlugin("delete_object", { instanceId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_update_component": {
        const instanceId = args?.instanceId as number;
        const componentType = args?.componentType as string;
        const fieldName = args?.fieldName as string;
        const fieldValue = args?.fieldValue as string;
        const data = await callUnityPlugin("update_component", { instanceId, componentType, fieldName, fieldValue });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_select_gameobject": {
        const instanceId = args?.instanceId as number;
        const focus = !!args?.focus;
        const data = await callUnityPlugin("select_object", { instanceId, fieldValue: focus ? "true" : "false" });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_control_playmode": {
        const state = args?.state as string;
        const data = await callUnityPlugin("control_playmode", { playModeState: state });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_logs": {
        const data = await callUnityPlugin("get_logs");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_clear_logs": {
        const data = await callUnityPlugin("clear_logs");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_compiler_errors": {
        const data = await callUnityPlugin("get_compiler_errors");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_project_context": {
        const data = await callUnityPlugin("get_project_context");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_project_map": {
        const data = await callUnityPlugin("get_project_map");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_run_tests": {
        const data = await callUnityPlugin("run_tests");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_performance_metrics": {
        const data = await callUnityPlugin("get_performance_metrics");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_get_profiler_report": {
        const data = await callUnityPlugin("get_profiler_report");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_build_project": {
        const outputPath = args?.outputPath as string;
        const data = await callUnityPlugin("build_project", { fieldValue: outputPath });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_build_and_archive": {
        const outputPath = args?.outputPath as string;
        const data = await callUnityPlugin("build_and_archive", { fieldValue: outputPath });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_install_package": {
        const packageName = args?.packageName as string;
        const data = await callUnityPlugin("install_package", { fieldValue: packageName });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_create_script": {
        const nameVal = args?.name as string;
        const code = args?.code as string;
        const data = await callUnityPlugin("create_script", { name: nameVal, code });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_create_shader": {
        const nameVal = args?.name as string;
        const code = args?.code as string;
        const data = await callUnityPlugin("create_shader", { name: nameVal, code });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_import_asset": {
        const sourcePath = args?.sourcePath as string;
        const targetPath = args?.targetPath as string;
        const data = await callUnityPlugin("import_asset", { fieldValue: sourcePath, prefabPath: targetPath });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_capture_viewport": {
        const data = await callUnityPlugin("capture_viewport");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_create_animator_state": {
        const controllerPath = args?.controllerPath as string;
        const stateName = args?.stateName as string;
        const clipPath = (args?.clipPath as string) || "";
        const data = await callUnityPlugin("create_animator_state", { fieldValue: controllerPath, name: stateName, prefabPath: clipPath });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_extract_localization": {
        const data = await callUnityPlugin("extract_localization");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_verify_meta_files": {
        const data = await callUnityPlugin("verify_meta_files");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_create_custom_inspector": {
        const targetClass = args?.targetClass as string;
        const inspectorName = args?.inspectorName as string;
        const data = await callUnityPlugin("create_custom_inspector", { name: targetClass, fieldValue: inspectorName });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_quest_devices": {
        const stdout = await runAdbCommand("devices");
        return { content: [{ type: "text", text: JSON.stringify({ success: true, stdout }, null, 2) }] };
      }
      case "unity_quest_install": {
        const apkPath = path.resolve(args?.apkPath as string);
        if (!fs.existsSync(apkPath)) {
          throw new Error(`Local APK file not found at: ${apkPath}`);
        }
        const stdout = await runAdbCommand(`install -r "${apkPath}"`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, stdout }, null, 2) }] };
      }
      case "unity_quest_launch": {
        const pkg = args?.packageName as string;
        const stdout = await runAdbCommand(`shell am start -n ${pkg}/com.unity3d.player.UnityPlayerActivity`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, stdout }, null, 2) }] };
      }
      case "unity_quest_logs": {
        const stdout = await runAdbCommand("logcat -d -s Unity");
        return { content: [{ type: "text", text: JSON.stringify({ success: true, stdout }, null, 2) }] };
      }
      case "unity_quest_screenshot": {
        const localPath = path.resolve(args?.localPath as string);
        await runAdbCommand("shell screencap -p /sdcard/quest_shot.png");
        const stdout = await runAdbCommand(`pull /sdcard/quest_shot.png "${localPath}"`);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, stdout, savedTo: localPath }, null, 2) }] };
      }
      case "unity_execute_script": {
        const code = args?.code as string;
        const data = await callUnityPlugin("eval_csharp", { code });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_find_assets": {
        const query = (args?.query as string).toLowerCase();
        const ext = args?.extension as string;
        const workspacePath = process.cwd();

        const allFiles = walkDir(workspacePath);
        const filtered = allFiles
          .map((file) => path.relative(workspacePath, file))
          .filter((file) => {
            const matchesQuery = path.basename(file).toLowerCase().includes(query);
            if (ext) {
              return matchesQuery && file.endsWith(`.${ext}`);
            }
            return matchesQuery;
          });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: filtered.length,
                  assets: filtered.slice(0, 50)
                },
                null,
                2
              )
            }
          ]
        };
      }
      case "unity_search_assets": {
        const filter = args?.filter as string;
        const data = await callUnityPlugin("search_assets", { fieldValue: filter });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_bind_script_component": {
        const instanceId = args?.instanceId as number;
        const className = args?.className as string;
        const data = await callUnityPlugin("bind_script_component", { instanceId, name: className });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      case "unity_autofix_compiler_errors": {
        const data = await callUnityPlugin("get_compiler_errors");
        if (!data.success) {
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }
        if (!data.errors || data.errors.length === 0) {
          return { content: [{ type: "text", text: JSON.stringify({ success: true, message: "No compilation errors found in Unity project." }, null, 2) }] };
        }

        const firstError = data.errors[0];
        const errorFile = firstError.file;
        const errorLine = firstError.line;
        const errorMessage = firstError.message;

        let codeContext = "";
        let lineStart = 1;
        try {
          const absolutePath = path.resolve(process.cwd(), errorFile);
          if (fs.existsSync(absolutePath)) {
            const fileLines = fs.readFileSync(absolutePath, "utf-8").split("\n");
            lineStart = Math.max(1, errorLine - 5);
            const lineEnd = Math.min(fileLines.length, errorLine + 5);
            codeContext = fileLines.slice(lineStart - 1, lineEnd).map((line, idx) => `${lineStart + idx}: ${line}`).join("\n");
          }
        } catch (e: any) {
          codeContext = `Failed to read source file: ${e.message}`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Compilation errors found. Please inspect the details below, edit the file to fix the error, and re-run compilation checks.",
                errorDetails: {
                  message: errorMessage,
                  file: errorFile,
                  line: errorLine,
                  column: firstError.column
                },
                codeContext: {
                  contextStartLine: lineStart,
                  codeSnippet: codeContext
                }
              }, null, 2)
            }
          ]
        };
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: error.message || error }, null, 2)
        }
      ]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[Unity MCP] Server running on stdio.");

  try {
    const wsUrl = `ws://localhost:${UNITY_PORT}/`;
    if (typeof globalThis.WebSocket !== "undefined") {
      const ws = new globalThis.WebSocket(wsUrl);
      ws.onopen = () => {
        console.error(`[Unity WS] Connected to selection/logs broadcast channel.`);
      };
      ws.onmessage = (event) => {
        console.error(`[Unity EVENT] ${event.data}`);
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
    }
  } catch (e) {}
}

main().catch((error) => {
  console.error("Fatal error starting Unity MCP Server:", error);
  process.exit(1);
});
