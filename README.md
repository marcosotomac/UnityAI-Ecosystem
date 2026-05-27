# Unity AI Developer Ecosystem

An enterprise-grade, plug-and-play AI developer assistant ecosystem for Unity. It bridges the gap between local AI agents (Claude, Cursor, VS Code Cline) and your running Unity Editor, with full deployment capabilities for **Meta Quest (VR/XR)** headsets.

---

## Architecture Overview

1. **Unity Editor C# UPM Package**: A lightweight, zero-dependency C# server running on port `3024` with WebSocket notifications.
2. **TypeScript MCP Server**: Exposes 33 developer tools to LLMs using Anthropic's Model Context Protocol.
3. **CLI Helper (`unity-ai`)**: Installs the plugin and configures your IDE/Claude configurations automatically.
4. **Agent Skills**: Pre-packaged markdown guidelines for optimal script generation and VR physics programming on Quest.

---

## 🚀 Quick Setup (Under 2 Minutes)

### 1. Clone & Compile
Download the repository to your machine, install monorepo workspaces, and build:
```bash
git clone https://github.com/username/unity-ecosystem.git
cd unity-ecosystem
npm install
npm run build
```

### 2. Install the CLI tool
Link the CLI globally on your system so you can use the `unity-ai` command anywhere:
```bash
cd packages/cli
npm link
```
*Now the `unity-ai` command is available in your shell terminal!*

### 3. Add to your Unity Project (UPM Standard)
We have structured the C# plugin as a standard **Unity Package Manager (UPM)** package.
1. Open your project in Unity.
2. Open the **Package Manager** (`Window > Package Manager`).
3. Click the **+** (add) button in the top-left and select **Add package from disk...**.
4. Navigate to your cloned workspace and select: `unity-ecosystem/packages/unity-plugin/package.json`.
5. Unity will install and compile the plugin. The server starts **automatically** on port `3024`.

*Alternatively, you can add it via Git URL:*
`https://github.com/username/unity-ecosystem.git?path=/packages/unity-plugin`

### 4. Configure your AI Agent (One-Click)
Run the auto-configure command to instantly set up **Claude Desktop**:
```bash
unity-ai configure
```
*Restart Claude Desktop, open your Unity project, and start chatting!*

---

## Available MCP Tools (33 Total)

- **Hierarchy & Scene**: `unity_get_scene_hierarchy`, `unity_get_gameobject_details`, `unity_select_gameobject` (with viewport camera tracking).
- **Modification**: `unity_create_gameobject` (supports prefab paths), `unity_delete_gameobject`, `unity_update_component` (reflection-based properties).
- **Play Testing**: `unity_control_playmode`, `unity_get_logs`, `unity_clear_logs`.
- **Diagnostics**: `unity_get_compiler_errors`, `unity_get_performance_metrics`, `unity_get_profiler_report` (GC average allocations and FPS tracking).
- **Assets & Code**: `unity_create_script`, `unity_create_shader`, `unity_import_asset` (workspace files copy), `unity_create_custom_inspector`, `unity_verify_meta_files` (meta recovery).
- **VR Meta Quest**: `unity_quest_devices` (ADB list), `unity_quest_install`, `unity_quest_launch`, `unity_quest_logs` (logcat Unity filter), `unity_quest_screenshot` (Quest screen capture).
- **Build Engine**: `unity_build_project`, `unity_build_and_archive` (build folder zip archiving).
- **Package Manager**: `unity_install_package` (programmatic Package Manager installations).
- **Dynamic C# Evaluation**: `unity_execute_script` (eval C# macros).

---

## 🛠 Troubleshooting

Run the doctor command to diagnose connection issues with Unity:
```bash
unity-ai doctor
```
Ensure the server is running in Unity (`Tools > Unity AI > Start Server`). WebSockets will push selection changes and compilation errors to the AI client automatically in real-time.
