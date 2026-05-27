using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEditor.PackageManager;
using UnityEditor.TestTools.TestRunner.Api;
using UnityEngine;

namespace UnityAI
{
    [InitializeOnLoad]
    public static class UnityAIServer
    {
        private static HttpListener listener;
        private static readonly int Port = 3024;
        private static bool isRunning = false;
        private static readonly List<LogEntry> logsBuffer = new List<LogEntry>();
        private static readonly int MaxLogs = 100;

        private static readonly List<WebSocket> activeWebSockets = new List<WebSocket>();

        private static readonly List<float> frameTimes = new List<float>();
        private static readonly List<long> gcAllocations = new List<long>();
        private static double lastTime = 0;
        private static long lastMemory = 0;
        private static readonly int MaxSamples = 300;

        [Serializable]
        public struct LogEntry
        {
            public string log;
            public string stackTrace;
            public string type;
            public string time;
        }

        [Serializable]
        public class ActionRequest
        {
            public string action;
            public int instanceId;
            public string name;
            public string componentType;
            public string fieldName;
            public string fieldValue;
            public int parentId;
            public string playModeState;
            public string code;
            public string prefabPath;
        }

        private class TestListener : ICallbacks
        {
            public List<string> Results = new List<string>();
            public bool IsFinished = false;

            public void RunStarted(ITestAdaptor testsToRun) { }
            public void RunFinished(ITestResultAdaptor result) { IsFinished = true; }
            public void TestStarted(ITestAdaptor test) { }
            public void TestFinished(ITestResultAdaptor result)
            {
                if (!result.HasChildren)
                {
                    string status = result.TestStatus.ToString();
                    string msg = result.Message;
                    string stack = result.StackTrace;
                    Results.Add($"{{" +
                                $"\"name\":{JsonEscape(result.FullName)}," +
                                $"\"status\":{JsonEscape(status)}," +
                                $"\"message\":{JsonEscape(msg)}," +
                                $"\"stackTrace\":{JsonEscape(stack)}" +
                                $"}}");
                }
            }
        }

        static UnityAIServer()
        {
            EditorApplication.delayCall += StartServer;
            Application.logMessageReceived += LogCallback;
            Selection.selectionChanged += OnSelectionChanged;
            EditorApplication.update += OnEditorUpdate;
        }

        [MenuItem("Tools/Unity AI/Start Server")]
        public static void StartServer()
        {
            if (isRunning)
            {
                Debug.Log("[UnityAI] Server is already running.");
                return;
            }

            try
            {
                listener = new HttpListener();
                listener.Prefixes.Add($"http://localhost:{Port}/");
                listener.Start();
                isRunning = true;

                Task.Run(ListenLoop);
                Debug.Log($"[UnityAI] Server successfully started on http://localhost:{Port}/");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[UnityAI] Failed to start server: {ex.Message}");
            }
        }

        [MenuItem("Tools/Unity AI/Stop Server")]
        public static void StopServer()
        {
            if (!isRunning) return;

            isRunning = false;
            listener?.Close();
            listener = null;
            Debug.Log("[UnityAI] Server stopped.");
        }

        private static void OnSelectionChanged()
        {
            var go = Selection.activeGameObject;
            int id = go != null ? go.GetInstanceID() : 0;
            string name = go != null ? go.name : "None";
            string json = $"{{\"event\":\"selection_changed\",\"instanceId\":{id},\"name\":{JsonEscape(name)}}}";
            BroadcastWebSocketMessage(json);
        }

        private static void OnEditorUpdate()
        {
            double currentTime = EditorApplication.timeSinceStartup;
            float deltaTime = (float)(currentTime - lastTime);
            lastTime = currentTime;

            if (deltaTime > 0 && deltaTime < 2f)
            {
                frameTimes.Add(deltaTime);
                if (frameTimes.Count > MaxSamples) frameTimes.RemoveAt(0);
            }

            long currentMemory = GC.GetTotalMemory(false);
            long diff = currentMemory - lastMemory;
            lastMemory = currentMemory;

            if (diff > 0)
            {
                gcAllocations.Add(diff);
                if (gcAllocations.Count > MaxSamples) gcAllocations.RemoveAt(0);
            }
        }

        private static void LogCallback(string logString, string stackTrace, LogType type)
        {
            lock (logsBuffer)
            {
                logsBuffer.Add(new LogEntry
                {
                    log = logString,
                    stackTrace = stackTrace,
                    type = type.ToString(),
                    time = DateTime.Now.ToString("HH:mm:ss")
                });
                if (logsBuffer.Count > MaxLogs)
                {
                    logsBuffer.RemoveAt(0);
                }
            }

            string json = $"{{\"event\":\"log_received\",\"log\":{JsonEscape(logString)},\"type\":{JsonEscape(type.ToString())},\"time\":{JsonEscape(DateTime.Now.ToString(\"HH:mm:ss\"))}}}";
            BroadcastWebSocketMessage(json);
        }

        private static async Task ListenLoop()
        {
            while (isRunning)
            {
                try
                {
                    var context = await listener.GetContextAsync();
                    if (context.Request.IsWebSocketRequest)
                    {
                        HttpListenerWebSocketContext wsContext = await context.AcceptWebSocketAsync(subProtocol: null);
                        _ = Task.Run(() => HandleWebSocketConnection(wsContext.WebSocket));
                    }
                    else
                    {
                        _ = Task.Run(() => HandleRequest(context));
                    }
                }
                catch (Exception)
                {
                    if (!isRunning) break;
                }
            }
        }

        private static async Task HandleWebSocketConnection(WebSocket socket)
        {
            lock (activeWebSockets)
            {
                activeWebSockets.Add(socket);
            }

            byte[] buffer = new byte[1024];
            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), System.Threading.CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", System.Threading.CancellationToken.None);
                    }
                }
            }
            catch { }
            finally
            {
                lock (activeWebSockets)
                {
                    activeWebSockets.Remove(socket);
                }
                socket.Dispose();
            }
        }

        private static void BroadcastWebSocketMessage(string message)
        {
            byte[] buffer = Encoding.UTF8.GetBytes(message);
            List<WebSocket> toRemove = new List<WebSocket>();

            lock (activeWebSockets)
            {
                foreach (var socket in activeWebSockets)
                {
                    if (socket.State == WebSocketState.Open)
                    {
                        _ = SendToSocket(socket, buffer);
                    }
                    else
                    {
                        toRemove.Add(socket);
                    }
                }
                foreach (var s in toRemove)
                {
                    activeWebSockets.Remove(s);
                }
            }
        }

        private static async Task SendToSocket(WebSocket socket, byte[] buffer)
        {
            try
            {
                await socket.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, endOfMessage: true, cancellationToken: System.Threading.CancellationToken.None);
            }
            catch { }
        }

        private static async void HandleRequest(HttpListenerContext context)
        {
            var request = context.Request;
            var response = context.Response;

            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = (int)HttpStatusCode.OK;
                response.Close();
                return;
            }

            string responseString = "";
            try
            {
                if (request.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                    {
                        string body = await reader.ReadToEndAsync();
                        var payload = JsonUtility.FromJson<ActionRequest>(body);
                        if (payload == null || string.IsNullOrEmpty(payload.action))
                        {
                            responseString = "{\"success\":false,\"error\":\"Invalid request format\"}";
                        }
                        else
                        {
                            responseString = await ExecuteAction(payload);
                        }
                    }
                }
                else
                {
                    responseString = "{\"success\":false,\"error\":\"Only POST requests are supported\"}";
                }
            }
            catch (Exception ex)
            {
                responseString = $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }

            byte[] buffer = Encoding.UTF8.GetBytes(responseString);
            response.ContentType = "application/json";
            response.ContentLength64 = buffer.Length;
            try
            {
                using (var output = response.OutputStream)
                {
                    await output.WriteAsync(buffer, 0, buffer.Length);
                }
            }
            catch (Exception) { }
        }

        private static Task<T> RunOnMainThread<T>(Func<T> action)
        {
            var tcs = new TaskCompletionSource<T>();
            EditorApplication.delayCall += () =>
            {
                try
                {
                    T result = action();
                    tcs.SetResult(result);
                }
                catch (Exception ex)
                {
                    tcs.SetException(ex);
                }
            };
            return tcs.Task;
        }

        private static async Task<string> ExecuteAction(ActionRequest req)
        {
            switch (req.action)
            {
                case "ping":
                    return await RunOnMainThread(() => HandlePing());
                case "get_hierarchy":
                    return await RunOnMainThread(() => HandleGetHierarchy());
                case "get_details":
                    return await RunOnMainThread(() => HandleGetDetails(req.instanceId));
                case "create_object":
                    return await RunOnMainThread(() => HandleCreateObject(req));
                case "delete_object":
                    return await RunOnMainThread(() => HandleDeleteObject(req.instanceId));
                case "update_component":
                    return await RunOnMainThread(() => HandleUpdateComponent(req));
                case "select_object":
                    return await RunOnMainThread(() => HandleSelectObject(req.instanceId, req.fieldValue == "true"));
                case "control_playmode":
                    return await RunOnMainThread(() => HandleControlPlayMode(req.playModeState));
                case "get_logs":
                    return HandleGetLogs();
                case "clear_logs":
                    return await RunOnMainThread(() => HandleClearLogs());
                case "get_compiler_errors":
                    return await RunOnMainThread(() => HandleGetCompilerErrors());
                case "get_project_context":
                    return await RunOnMainThread(() => HandleGetProjectContext());
                case "get_project_map":
                    return await RunOnMainThread(() => HandleGetProjectMap());
                case "run_tests":
                    return await RunOnMainThread(() => HandleRunTests());
                case "get_performance_metrics":
                    return await RunOnMainThread(() => HandleGetPerformanceMetrics());
                case "get_profiler_report":
                    return HandleGetProfilerReport();
                case "build_project":
                    return await RunOnMainThread(() => HandleBuildProject(req.fieldValue));
                case "build_and_archive":
                    return await RunOnMainThread(() => HandleBuildAndArchive(req.fieldValue));
                case "install_package":
                    return await HandleInstallPackage(req.fieldValue);
                case "create_script":
                    return await RunOnMainThread(() => HandleCreateScript(req));
                case "create_shader":
                    return await RunOnMainThread(() => HandleCreateShader(req.name, req.code));
                case "import_asset":
                    return await RunOnMainThread(() => HandleImportAsset(req.fieldValue, req.prefabPath));
                case "capture_viewport":
                    return await RunOnMainThread(() => HandleCaptureViewport());
                case "create_animator_state":
                    return await RunOnMainThread(() => HandleCreateAnimatorState(req.fieldValue, req.name, req.prefabPath));
                case "extract_localization":
                    return await RunOnMainThread(() => HandleExtractLocalization());
                case "verify_meta_files":
                    return await RunOnMainThread(() => HandleVerifyMetaFiles());
                case "create_custom_inspector":
                    return await RunOnMainThread(() => HandleCreateCustomInspector(req.name, req.fieldValue));
                case "eval_csharp":
                    return await HandleEvalCSharp(req.code);
                case "search_assets":
                    return await RunOnMainThread(() => HandleSearchAssets(req.fieldValue));
                case "bind_script_component":
                    return await RunOnMainThread(() => HandleBindScriptComponent(req.instanceId, req.name));
                default:
                    return $"{{\"success\":false,\"error\":\"Unknown action: {req.action}\"}}";
            }
        }

        private static string HandlePing()
        {
            var currentScene = UnityEngine.SceneManagement.SceneManager.GetActiveScene();
            var selectedGo = Selection.activeGameObject;
            int selectedId = selectedGo != null ? selectedGo.GetInstanceID() : 0;
            string selectedName = selectedGo != null ? selectedGo.name : "";

            return $"{{" +
                   $"\"success\":true," +
                   $"\"unityVersion\":\"{Application.unityVersion}\"," +
                   $"\"platform\":\"{Application.platform}\"," +
                   $"\"projectPath\":{JsonEscape(Directory.GetCurrentDirectory())}," +
                   $"\"activeScene\":{JsonEscape(currentScene.name)}," +
                   $"\"isPlaying\":{(EditorApplication.isPlaying ? "true" : "false")}," +
                   $"\"isPaused\":{(EditorApplication.isPaused ? "true" : "false")}," +
                   $"\"isCompiling\":{(EditorApplication.isCompiling ? "true" : "false")}," +
                   $"\"selectedObjectId\":{selectedId}," +
                   $"\"selectedObjectName\":{JsonEscape(selectedName)}" +
                   $"}}";
        }

        private static string HandleGetHierarchy()
        {
            var roots = UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects();
            var sb = new StringBuilder();
            sb.Append("{\"success\":true,\"hierarchy\":[");
            for (int i = 0; i < roots.Length; i++)
            {
                if (i > 0) sb.Append(",");
                SerializeGameObject(roots[i], sb);
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private static void SerializeGameObject(GameObject go, StringBuilder sb)
        {
            sb.Append("{");
            sb.Append($"\"name\":{JsonEscape(go.name)},");
            sb.Append($"\"instanceId\":{go.GetInstanceID()},");
            sb.Append($"\"active\":{(go.activeSelf ? "true" : "false")},");
            sb.Append($"\"tag\":{JsonEscape(go.tag)},");
            sb.Append($"\"layer\":{go.layer},");

            var t = go.transform;
            sb.Append($"\"position\":{{\"x\":{t.position.x},\"y\":{t.position.y},\"z\":{t.position.z}}},");

            sb.Append("\"components\":[");
            var comps = go.GetComponents<Component>();
            int compCount = 0;
            foreach (var c in comps)
            {
                if (c == null) continue;
                if (compCount > 0) sb.Append(",");
                sb.Append(JsonEscape(c.GetType().Name));
                compCount++;
            }
            sb.Append("],");

            sb.Append("\"children\":[");
            for (int i = 0; i < t.childCount; i++)
            {
                if (i > 0) sb.Append(",");
                SerializeGameObject(t.GetChild(i).gameObject, sb);
            }
            sb.Append("]");
            sb.Append("}");
        }

        private static string HandleGetDetails(int instanceId)
        {
            var go = EditorUtility.InstanceIDToObject(instanceId) as GameObject;
            if (go == null)
            {
                return "{\"success\":false,\"error\":\"GameObject not found\"}";
            }

            var sb = new StringBuilder();
            sb.Append("{\"success\":true,");
            sb.Append($"\"name\":{JsonEscape(go.name)},");
            sb.Append($"\"instanceId\":{go.GetInstanceID()},");
            sb.Append($"\"tag\":{JsonEscape(go.tag)},");
            sb.Append($"\"layer\":{go.layer},");
            sb.Append($"\"activeSelf\":{(go.activeSelf ? "true" : "false")},");
            sb.Append($"\"activeInHierarchy\":{(go.activeInHierarchy ? "true" : "false")},");

            sb.Append("\"components\":[");
            var comps = go.GetComponents<Component>();
            int compIndex = 0;
            foreach (var comp in comps)
            {
                if (comp == null) continue;
                if (compIndex > 0) sb.Append(",");
                sb.Append("{");
                sb.Append($"\"type\":{JsonEscape(comp.GetType().FullName)},");
                sb.Append("\"fields\":{");

                var fields = comp.GetType().GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
                int fieldCount = 0;
                foreach (var f in fields)
                {
                    bool isSerialized = f.IsPublic || f.GetCustomAttributes(typeof(SerializeField), true).Length > 0;
                    if (!isSerialized) continue;
                    if (fieldCount > 0) sb.Append(",");
                    object val = null;
                    try { val = f.GetValue(comp); } catch { val = "Unreadable"; }
                    sb.Append($"\"{f.Name}\":{JsonEscape(val?.ToString() ?? "null")}");
                    fieldCount++;
                }

                sb.Append("},\"properties\":{");

                var props = comp.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                int propCount = 0;
                foreach (var p in props)
                {
                    if (!p.CanRead || p.GetIndexParameters().Length > 0) continue;
                    var pType = p.PropertyType;
                    if (pType.IsPrimitive || pType == typeof(string) || pType == typeof(Vector3) || pType == typeof(Vector2) || pType == typeof(Quaternion))
                    {
                        if (propCount > 0) sb.Append(",");
                        object val = null;
                        try { val = p.GetValue(comp, null); } catch { val = "Unreadable"; }
                        sb.Append($"\"{p.Name}\":{JsonEscape(val?.ToString() ?? "null")}");
                        propCount++;
                    }
                }

                sb.Append("}");
                sb.Append("}");
                compIndex++;
            }
            sb.Append("]");
            sb.Append("}");
            return sb.ToString();
        }

        private static string HandleCreateObject(ActionRequest req)
        {
            GameObject go = null;

            if (!string.IsNullOrEmpty(req.prefabPath))
            {
                var prefabAsset = AssetDatabase.LoadAssetAtPath<GameObject>(req.prefabPath);
                if (prefabAsset != null)
                {
                    go = PrefabUtility.InstantiatePrefab(prefabAsset) as GameObject;
                    if (go != null && !string.IsNullOrEmpty(req.name))
                    {
                        go.name = req.name;
                    }
                }
                else
                {
                    return $"{{\"success\":false,\"error\":\"Prefab not found at path: {req.prefabPath}\"}}";
                }
            }
            else
            {
                go = new GameObject(string.IsNullOrEmpty(req.name) ? "New GameObject" : req.name);
            }

            if (req.parentId != 0)
            {
                var parent = EditorUtility.InstanceIDToObject(req.parentId) as GameObject;
                if (parent != null)
                {
                    go.transform.SetParent(parent.transform);
                }
            }

            if (!string.IsNullOrEmpty(req.componentType))
            {
                var types = req.componentType.Split(',');
                foreach (var t in types)
                {
                    var cleanT = t.Trim();
                    var compType = FindType(cleanT);
                    if (compType != null)
                    {
                        go.AddComponent(compType);
                    }
                    else
                    {
                        try { go.AddComponent(System.Type.GetType($"UnityEngine.{cleanT}, UnityEngine")); } catch { }
                    }
                }
            }

            Undo.RegisterCreatedObjectUndo(go, $"Created {go.name}");
            return $"{{\"success\":true,\"instanceId\":{go.GetInstanceID()},\"name\":{JsonEscape(go.name)}}}";
        }

        private static string HandleDeleteObject(int instanceId)
        {
            var go = EditorUtility.InstanceIDToObject(instanceId) as GameObject;
            if (go == null)
            {
                return "{\"success\":false,\"error\":\"GameObject not found\"}";
            }
            string name = go.name;
            Undo.DestroyObjectImmediate(go);
            return $"{{\"success\":true,\"deleted\":{JsonEscape(name)}}}";
        }

        private static string HandleUpdateComponent(ActionRequest req)
        {
            var go = EditorUtility.InstanceIDToObject(req.instanceId) as GameObject;
            if (go == null)
            {
                return "{\"success\":false,\"error\":\"GameObject not found\"}";
            }

            var comp = go.GetComponent(req.componentType);
            if (comp == null)
            {
                var type = FindType(req.componentType);
                if (type != null) comp = go.GetComponent(type);
            }

            if (comp == null)
            {
                return $"{{\"success\":false,\"error\":\"Component of type {req.componentType} not found on GameObject\"}}";
            }

            Undo.RecordObject(comp, $"Updated {req.fieldName} on {comp.GetType().Name}");

            var field = comp.GetType().GetField(req.fieldName, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
            if (field != null)
            {
                try
                {
                    object parsed = ParseValue(field.FieldType, req.fieldValue);
                    field.SetValue(comp, parsed);
                    EditorUtility.SetDirty(comp);
                    return "{\"success\":true}";
                }
                catch (Exception ex)
                {
                    return $"{{\"success\":false,\"error\":\"Field write error: {JsonEscape(ex.Message)}\"}}";
                }
            }

            var prop = comp.GetType().GetProperty(req.fieldName, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
            if (prop != null && prop.CanWrite)
            {
                try
                {
                    object parsed = ParseValue(prop.PropertyType, req.fieldValue);
                    prop.SetValue(comp, parsed, null);
                    EditorUtility.SetDirty(comp);
                    return "{\"success\":true}";
                }
                catch (Exception ex)
                {
                    return $"{{\"success\":false,\"error\":\"Property write error: {JsonEscape(ex.Message)}\"}}";
                }
            }

            return $"{{\"success\":false,\"error\":\"Field or property '{req.fieldName}' not found on {comp.GetType().Name}\"}}";
        }

        private static string HandleSelectObject(int instanceId, bool focus)
        {
            var go = EditorUtility.InstanceIDToObject(instanceId) as GameObject;
            if (go == null)
            {
                return "{\"success\":false,\"error\":\"GameObject not found\"}";
            }

            Selection.activeGameObject = go;
            if (focus)
            {
                SceneView.FrameLastActiveSceneView();
            }
            return "{\"success\":true}";
        }

        private static string HandleControlPlayMode(string state)
        {
            if (state == "play")
            {
                EditorApplication.isPlaying = true;
            }
            else if (state == "pause")
            {
                EditorApplication.isPaused = true;
            }
            else if (state == "stop")
            {
                EditorApplication.isPlaying = false;
                EditorApplication.isPaused = false;
            }
            return $"{{\"success\":true,\"isPlaying\":{(EditorApplication.isPlaying ? "true" : "false")},\"isPaused\":{(EditorApplication.isPaused ? "true" : "false")}}}";
        }

        private static string HandleGetLogs()
        {
            var sb = new StringBuilder();
            sb.Append("{\"success\":true,\"logs\":[");
            lock (logsBuffer)
            {
                for (int i = 0; i < logsBuffer.Count; i++)
                {
                    if (i > 0) sb.Append(",");
                    var entry = logsBuffer[i];
                    sb.Append("{");
                    sb.Append($"\"log\":{JsonEscape(entry.log)},");
                    sb.Append($"\"stackTrace\":{JsonEscape(entry.stackTrace)},");
                    sb.Append($"\"type\":{JsonEscape(entry.type)},");
                    sb.Append($"\"time\":{JsonEscape(entry.time)}");
                    sb.Append("}");
                }
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string HandleClearLogs()
        {
            try
            {
                var logEntries = System.Type.GetType("UnityEditor.LogEntries, UnityEditor");
                if (logEntries != null)
                {
                    var clearMethod = logEntries.GetMethod("Clear", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public);
                    if (clearMethod != null)
                    {
                        clearMethod.Invoke(null, null);
                        lock (logsBuffer)
                        {
                            logsBuffer.Clear();
                        }
                        return "{\"success\":true}";
                    }
                }
                return "{\"success\":false,\"error\":\"LogEntries.Clear method not found\"}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleGetCompilerErrors()
        {
            var messages = CompilationPipeline.GetCompilerMessages();
            var sb = new StringBuilder();
            sb.Append("{\"success\":true,\"errors\":[");
            int errCount = 0;
            foreach (var msg in messages)
            {
                if (msg.type == CompilerMessageType.Error)
                {
                    if (errCount > 0) sb.Append(",");
                    sb.Append("{");
                    sb.Append($"\"message\":{JsonEscape(msg.message)},");
                    sb.Append($"\"file\":{JsonEscape(msg.file)},");
                    sb.Append($"\"line\":{msg.line},");
                    sb.Append($"\"column\":{msg.column}");
                    sb.Append("}");
                    errCount++;
                }
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private static string HandleGetProjectContext()
        {
            string manifestJson = "{}";
            try
            {
                string manifestPath = Path.Combine(Directory.GetCurrentDirectory(), "Packages", "manifest.json");
                if (File.Exists(manifestPath)) manifestJson = File.ReadAllText(manifestPath);
            }
            catch { }

            var tags = UnityEditorInternal.InternalEditorUtility.tags;
            var layers = UnityEditorInternal.InternalEditorUtility.layers;

            var sb = new StringBuilder();
            sb.Append("{");
            sb.Append("\"success\":true,");
            sb.Append($"\"colorSpace\":\"{PlayerSettings.colorSpace}\",");
            sb.Append($"\"buildTarget\":\"{EditorUserBuildSettings.activeBuildTarget}\",");
            sb.Append($"\"scriptingBackend\":\"{PlayerSettings.GetScriptingBackend(EditorUserBuildSettings.selectedBuildTargetGroup)}\",");

            sb.Append("\"tags\":[");
            for (int i = 0; i < tags.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(tags[i]));
            }
            sb.Append("],");

            sb.Append("\"layers\":[");
            for (int i = 0; i < layers.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(layers[i]));
            }
            sb.Append("],");

            sb.Append($"\"packages\":{manifestJson}");
            sb.Append("}");
            return sb.ToString();
        }

        private static string HandleGetProjectMap()
        {
            var scenes = Directory.GetFiles("Assets", "*.unity", SearchOption.AllDirectories);
            var prefabs = Directory.GetFiles("Assets", "*.prefab", SearchOption.AllDirectories);
            var scripts = Directory.GetFiles("Assets", "*.cs", SearchOption.AllDirectories);
            var asmdefs = Directory.GetFiles("Assets", "*.asmdef", SearchOption.AllDirectories);

            var sb = new StringBuilder();
            sb.Append("{");
            sb.Append("\"success\":true,");

            sb.Append("\"scenes\":[");
            for (int i = 0; i < scenes.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(scenes[i].Replace('\\', '/')));
            }
            sb.Append("],");

            sb.Append("\"prefabs\":[");
            for (int i = 0; i < prefabs.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(prefabs[i].Replace('\\', '/')));
            }
            sb.Append("],");

            sb.Append("\"scripts\":[");
            for (int i = 0; i < scripts.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(scripts[i].Replace('\\', '/')));
            }
            sb.Append("],");

            sb.Append("\"assemblyDefinitions\":[");
            for (int i = 0; i < asmdefs.Length; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(JsonEscape(asmdefs[i].Replace('\\', '/')));
            }
            sb.Append("]");

            sb.Append("}");
            return sb.ToString();
        }

        private static string HandleGetPerformanceMetrics()
        {
            long monoHeap = UnityEngine.Profiling.Profiler.GetMonoHeapSizeLong();
            long monoUsed = UnityEngine.Profiling.Profiler.GetMonoUsedSizeLong();
            long gfxMemory = SystemInfo.graphicsMemorySize;
            long sysMemory = SystemInfo.systemMemorySize;

            return $"{{" +
                   $"\"success\":true," +
                   $"\"monoHeapSize\":{monoHeap}," +
                   $"\"monoUsedSize\":{monoUsed}," +
                   $"\"graphicsMemorySizeMb\":{gfxMemory}," +
                   $"\"systemMemorySizeMb\":{sysMemory}," +
                   $"\"frameCount\":{Time.frameCount}," +
                   $"\"isPlaying\":{(EditorApplication.isPlaying ? "true" : "false")}" +
                   $"}}";
        }

        private static string HandleGetProfilerReport()
        {
            float totalFrameTime = 0;
            float minFrameTime = float.MaxValue;
            float maxFrameTime = 0;
            foreach (var ft in frameTimes)
            {
                totalFrameTime += ft;
                if (ft < minFrameTime) minFrameTime = ft;
                if (ft > maxFrameTime) maxFrameTime = ft;
            }

            float avgFPS = frameTimes.Count > 0 ? frameTimes.Count / totalFrameTime : 0;
            float maxFPS = minFrameTime > 0 ? 1f / minFrameTime : 0;
            float minFPS = maxFrameTime > 0 ? 1f / maxFrameTime : 0;

            long totalAlloc = 0;
            long peakAlloc = 0;
            foreach (var alloc in gcAllocations)
            {
                totalAlloc += alloc;
                if (alloc > peakAlloc) peakAlloc = alloc;
            }
            double avgAllocKb = gcAllocations.Count > 0 ? (totalAlloc / (double)gcAllocations.Count) / 1024.0 : 0;
            double peakAllocKb = peakAlloc / 1024.0;

            return $"{{" +
                   $"\"success\":true," +
                   $"\"averageFPS\":{avgFPS.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                   $"\"minFPS\":{minFPS.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                   $"\"maxFPS\":{maxFPS.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                   $"\"averageGCAllocKb\":{avgAllocKb.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                   $"\"peakGCAllocKb\":{peakAllocKb.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                   $"\"frameCount\":{frameTimes.Count}" +
                   $"}}";
        }

        private static string HandleBuildProject(string outputFolder)
        {
            if (string.IsNullOrEmpty(outputFolder)) outputFolder = "Builds/ActiveTarget";

            var scenes = new List<string>();
            foreach (var scene in EditorBuildSettings.scenes)
            {
                if (scene.enabled) scenes.Add(scene.path);
            }

            if (scenes.Count == 0)
            {
                return "{\"success\":false,\"error\":\"No enabled scenes found in EditorBuildSettings.\"}";
            }

            string extension = "";
            BuildTarget target = EditorUserBuildSettings.activeBuildTarget;
            if (target == BuildTarget.StandaloneWindows || target == BuildTarget.StandaloneWindows64) extension = ".exe";
            else if (target == BuildTarget.StandaloneOSX) extension = ".app";
            else if (target == BuildTarget.Android) extension = ".apk";

            string buildPath = Path.Combine(outputFolder, "Game" + extension);

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = scenes.ToArray(),
                locationPathName = buildPath,
                target = target,
                options = BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                return $"{{" +
                       $"\"success\":true," +
                       $"\"outputPath\":{JsonEscape(buildPath.Replace('\\', '/'))}," +
                       $"\"errors\":0," +
                       $"\"warnings\":{report.summary.totalWarnings}" +
                       $"}}";
            }
            else
            {
                return $"{{" +
                       $"\"success\":false,\"error\":\"Build failed with state: {report.summary.result}\",\"errors\":{report.summary.totalErrors},\"warnings\":{report.summary.totalWarnings}}}";
            }
        }

        private static string HandleBuildAndArchive(string outputFolder)
        {
            if (string.IsNullOrEmpty(outputFolder)) outputFolder = "Builds/ActiveTarget";

            string buildResult = HandleBuildProject(outputFolder);
            if (!buildResult.Contains("\"success\":true"))
            {
                return buildResult;
            }

            try
            {
                string zipPath = outputFolder + "_Archive.zip";
                if (File.Exists(zipPath))
                {
                    File.Delete(zipPath);
                }

                ZipFile.CreateFromDirectory(outputFolder, zipPath);

                return $"{{\"success\":true,\"outputPath\":\"{zipPath.Replace('\\', '/')}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Compression failed: {JsonEscape(ex.Message)}\"}}";
            }
        }

        private static async Task<string> HandleInstallPackage(string packageName)
        {
            if (string.IsNullOrEmpty(packageName))
            {
                return "{\"success\":false,\"error\":\"Package name is empty\"}";
            }

            string resultJson = await RunOnMainThread(async () =>
            {
                var request = Client.Add(packageName);
                while (!request.IsCompleted)
                {
                    await Task.Delay(100);
                }

                if (request.Status == StatusCode.Success)
                {
                    return $"{{\"success\":true,\"package\":\"{packageName}\"}}";
                }
                else
                {
                    string err = request.Error != null ? request.Error.message : "Unknown Package Manager error";
                    return $"{{\"success\":false,\"error\":{JsonEscape(err)}}}";
                }
            });

            return resultJson;
        }

        private static string HandleCreateScript(ActionRequest req)
        {
            if (string.IsNullOrEmpty(req.name))
            {
                return "{\"success\":false,\"error\":\"Script name is empty\"}";
            }

            string scriptsFolder = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Scripts");
            if (!Directory.Exists(scriptsFolder))
            {
                Directory.CreateDirectory(scriptsFolder);
            }

            string filePath = Path.Combine(scriptsFolder, req.name + ".cs");
            if (File.Exists(filePath))
            {
                return $"{{\"success\":false,\"error\":\"Script {req.name}.cs already exists at {filePath}\"}}";
            }

            string codeBody = req.code;
            if (string.IsNullOrEmpty(codeBody))
            {
                codeBody = $@"using UnityEngine;

public class {req.name} : MonoBehaviour
{{
    void Start()
    {{
        
    }}

    void Update()
    {{
        
    }}
}}
";
            }

            File.WriteAllText(filePath, codeBody);
            AssetDatabase.Refresh();
            return $"{{\"success\":true,\"filePath\":\"Assets/Scripts/{req.name}.cs\"}}";
        }

        private static string HandleCreateShader(string name, string code)
        {
            if (string.IsNullOrEmpty(name)) return "{\"success\":false,\"error\":\"Shader name is required.\"}";

            string folderPath = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Shaders");
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            string filePath = Path.Combine(folderPath, name + ".shader");
            if (File.Exists(filePath))
            {
                return $"{{\"success\":false,\"error\":\"Shader {name}.shader already exists at {filePath}\"}}";
            }

            if (string.IsNullOrEmpty(code))
            {
                code = $@"Shader ""Custom/{name}""
{{
    Properties
    {{
        _Color (""Color"", Color) = (1,1,1,1)
        _MainTex (""Albedo (RGB)"", 2D) = ""white"" {{}}
        _Glossiness (""Smoothness"", Range(0,1)) = 0.5
        _Metallic (""Metallic"", Range(0,1)) = 0.0
    }}
    SubShader
    {{
        Tags {{ ""RenderType""=""Opaque"" }}
        LOD 200

        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0

        sampler2D _MainTex;

        struct Input
        {{
            float2 uv_MainTex;
        }};

        half _Glossiness;
        half _Metallic;
        fixed4 _Color;

        void surf (Input IN, inout SurfaceOutputStandard o)
        {{
            fixed4 c = tex2D (_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = c.rgb;
            o.Metallic = _Metallic;
            o.Smoothness = _Glossiness;
            o.Alpha = c.a;
        }}
        ENDCG
    }}
    FallBack ""Diffuse""
}}";
            }

            File.WriteAllText(filePath, code);
            AssetDatabase.Refresh();
            return $"{{\"success\":true,\"filePath\":\"Assets/Shaders/{name}.shader\"}}";
        }

        private static string HandleImportAsset(string sourcePath, string targetPath)
        {
            if (string.IsNullOrEmpty(sourcePath) || string.IsNullOrEmpty(targetPath))
            {
                return "{\"success\":false,\"error\":\"sourcePath and targetPath are required.\"}";
            }

            try
            {
                string fullSource = Path.GetFullPath(sourcePath);
                if (!File.Exists(fullSource))
                {
                    return $"{{\"success\":false,\"error\":\"Source file not found at: {sourcePath}\"}}";
                }

                if (!targetPath.StartsWith("Assets/"))
                {
                    targetPath = Path.Combine("Assets", targetPath).Replace('\\', '/');
                }

                string fullDest = Path.Combine(Directory.GetCurrentDirectory(), targetPath);
                string destDir = Path.GetDirectoryName(fullDest);
                if (!Directory.Exists(destDir))
                {
                    Directory.CreateDirectory(destDir);
                }

                File.Copy(fullSource, fullDest, overwrite: true);
                AssetDatabase.ImportAsset(targetPath);

                if (targetPath.EndsWith(".png") || targetPath.EndsWith(".jpg") || targetPath.EndsWith(".jpeg"))
                {
                    var importer = AssetImporter.GetAtPath(targetPath) as TextureImporter;
                    if (importer != null)
                    {
                        importer.textureType = TextureImporterType.Sprite;
                        importer.SaveAndReimport();
                    }
                }

                return $"{{\"success\":true,\"targetPath\":\"{targetPath}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleCaptureViewport()
        {
            try
            {
                var sceneView = SceneView.lastActiveSceneView;
                if (sceneView == null) return "{\"success\":false,\"error\":\"No active SceneView found\"}";

                var camera = sceneView.camera;
                if (camera == null) return "{\"success\":false,\"error\":\"SceneView camera not found\"}";

                int width = 800;
                int height = 600;
                RenderTexture rt = new RenderTexture(width, height, 24);
                RenderTexture oldRT = camera.targetTexture;
                camera.targetTexture = rt;
                camera.Render();
                camera.targetTexture = oldRT;

                RenderTexture.active = rt;
                Texture2D tex = new Texture2D(width, height, TextureFormat.RGB24, false);
                tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
                tex.Apply();

                byte[] bytes = tex.EncodeToPNG();

                RenderTexture.active = null;
                UnityEngine.Object.DestroyImmediate(rt);
                UnityEngine.Object.DestroyImmediate(tex);

                string base64 = Convert.ToBase64String(bytes);
                return $"{{\"success\":true,\"image\":\"{base64}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleCreateAnimatorState(string controllerPath, string stateName, string clipPath)
        {
            try
            {
                if (string.IsNullOrEmpty(controllerPath) || string.IsNullOrEmpty(stateName))
                {
                    return "{\"success\":false,\"error\":\"controllerPath and stateName are required.\"}";
                }

                if (!controllerPath.StartsWith("Assets/"))
                {
                    controllerPath = Path.Combine("Assets", controllerPath).Replace('\\', '/');
                }

                var controller = AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>(controllerPath);
                if (controller == null)
                {
                    controller = UnityEditor.Animations.AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
                }

                var rootStateMachine = controller.layers[0].stateMachine;
                var state = rootStateMachine.AddState(stateName);

                if (!string.IsNullOrEmpty(clipPath))
                {
                    if (!clipPath.StartsWith("Assets/"))
                    {
                        clipPath = Path.Combine("Assets", clipPath).Replace('\\', '/');
                    }
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
                    if (clip != null)
                    {
                        state.motion = clip;
                    }
                }

                EditorUtility.SetDirty(controller);
                AssetDatabase.SaveAssets();
                return $"{{\"success\":true,\"controllerPath\":\"{controllerPath}\",\"state\":\"{stateName}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleExtractLocalization()
        {
            try
            {
                var scripts = Directory.GetFiles("Assets", "*.cs", SearchOption.AllDirectories);
                var hardcodedStrings = new List<string>();

                foreach (var script in scripts)
                {
                    if (script.Contains("/Editor/") || script.Contains("UnityAI_TempEval")) continue;

                    string content = File.ReadAllText(script);
                    var matches = System.Text.RegularExpressions.Regex.Matches(content, @"""([^""\\]*(?:\\.[^""\\]*)*)""");
                    foreach (System.Text.RegularExpressions.Match m in matches)
                    {
                        string str = m.Groups[1].Value;
                        if (str.Length > 2 && !hardcodedStrings.Contains(str) && !str.StartsWith("/") && !str.Contains("\\"))
                        {
                            hardcodedStrings.Add(str);
                        }
                    }
                }

                var sb = new StringBuilder();
                sb.Append("{");
                for (int i = 0; i < hardcodedStrings.Count; i++)
                {
                    if (i > 0) sb.Append(",");
                    sb.Append($"\"{JsonEscape(hardcodedStrings[i])}\":\"{JsonEscape(hardcodedStrings[i])}\"");
                }
                sb.Append("}");

                string outputPath = "Assets/localization_extract.json";
                File.WriteAllText(outputPath, sb.ToString());
                AssetDatabase.Refresh();

                return $"{{\"success\":true,\"outputPath\":\"{outputPath}\",\"count\":{hardcodedStrings.Count}}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleVerifyMetaFiles()
        {
            try
            {
                var assets = Directory.GetFiles("Assets", "*.*", SearchOption.AllDirectories);
                var missingMetas = new List<string>();

                foreach (var asset in assets)
                {
                    if (asset.EndsWith(".meta")) continue;
                    string metaPath = asset + ".meta";
                    if (!File.Exists(metaPath))
                    {
                        missingMetas.Add(asset.Replace('\\', '/'));
                    }
                }

                if (missingMetas.Count > 0)
                {
                    AssetDatabase.Refresh();
                }

                var sb = new StringBuilder();
                sb.Append("{\"success\":true,\"fixedMetas\":[");
                for (int i = 0; i < missingMetas.Count; i++)
                {
                    if (i > 0) sb.Append(",");
                    sb.Append(JsonEscape(missingMetas[i]));
                }
                sb.Append("]}");
                return sb.ToString();
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleCreateCustomInspector(string targetClass, string inspectorName)
        {
            try
            {
                if (string.IsNullOrEmpty(targetClass) || string.IsNullOrEmpty(inspectorName))
                {
                    return "{\"success\":false,\"error\":\"targetClass and inspectorName are required.\"}";
                }

                string folderPath = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Editor");
                if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);

                string filePath = Path.Combine(folderPath, inspectorName + ".cs");
                string code = $@"using UnityEditor;
using UnityEngine;

[CustomEditor(typeof({targetClass}))]
public class {inspectorName} : Editor
{{
    public override void OnInspectorGUI()
    {{
        DrawDefaultInspector();
        
        {targetClass} myTarget = ({targetClass})target;
        
        GUILayout.Space(10);
        if (GUILayout.Button(""Run Custom Action"", GUILayout.Height(30)))
        {{
            Debug.Log(""Custom Editor Button Pressed on "" + myTarget.name);
        }}
    }}
}}";
                File.WriteAllText(filePath, code);
                AssetDatabase.Refresh();
                return $"{{\"success\":true,\"filePath\":\"Assets/Editor/{inspectorName}.cs\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static async Task<string> HandleEvalCSharp(string code)
        {
            if (string.IsNullOrEmpty(code))
            {
                return "{\"success\":false,\"error\":\"Code is empty\"}";
            }

            string folderPath = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Editor");
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            string filePath = Path.Combine(folderPath, "UnityAI_TempEval.cs");
            string scriptContent = $@"
using UnityEditor;
using UnityEngine;
using System;
using System.Collections.Generic;

public static class UnityAI_TempEval
{{
    public static string Execute()
    {{
        try
        {{
            {code}
        }}
        catch (Exception ex)
        {{
            return ""Exception: "" + ex.Message + ""\n"" + ex.StackTrace;
        }}
    }}
}}
";
            File.WriteAllText(filePath, scriptContent);

            await RunOnMainThread(() =>
            {
                AssetDatabase.Refresh();
                return true;
            });

            int timeout = 0;
            while (EditorApplication.isCompiling)
            {
                await Task.Delay(100);
                timeout++;
                if (timeout > 100)
                {
                    File.Delete(filePath);
                    return "{\"success\":false,\"error\":\"Compilation timed out.\"}";
                }
            }

            string evalResult = await RunOnMainThread(() =>
            {
                try
                {
                    var assemblies = AppDomain.CurrentDomain.GetAssemblies();
                    System.Type evalType = null;
                    foreach (var asm in assemblies)
                    {
                        evalType = asm.GetType("UnityAI_TempEval");
                        if (evalType != null) break;
                    }

                    if (evalType == null)
                    {
                        return "Error: Could not find compiled UnityAI_TempEval class.";
                    }

                    var method = evalType.GetMethod("Execute");
                    if (method == null)
                    {
                        return "Error: Could not find Execute method.";
                    }

                    object result = method.Invoke(null, null);
                    return result?.ToString() ?? "null";
                }
                catch (Exception ex)
                {
                    return "Reflection Execution Error: " + ex.Message;
                }
                finally
                {
                    if (File.Exists(filePath))
                    {
                        File.Delete(filePath);
                    }
                    AssetDatabase.Refresh();
                }
            });

            return $"{{\"success\":true,\"result\":{JsonEscape(evalResult)}}}";
        }

        private static Type FindType(string typeName)
        {
            var assemblies = AppDomain.CurrentDomain.GetAssemblies();
            foreach (var assembly in assemblies)
            {
                var type = assembly.GetType(typeName);
                if (type != null) return type;

                type = assembly.GetType($"UnityEngine.{typeName}");
                if (type != null) return type;
                type = assembly.GetType($"UnityEditor.{typeName}");
                if (type != null) return type;
            }
            return null;
        }

        private static object ParseValue(Type type, string valStr)
        {
            if (type == typeof(string)) return valStr;
            if (type == typeof(float)) return float.Parse(valStr, System.Globalization.CultureInfo.InvariantCulture);
            if (type == typeof(double)) return double.Parse(valStr, System.Globalization.CultureInfo.InvariantCulture);
            if (type == typeof(int)) return int.Parse(valStr);
            if (type == typeof(bool)) return bool.Parse(valStr);

            if (type == typeof(Vector3))
            {
                var clean = valStr.Replace("(", "").Replace(")", "").Trim();
                var parts = clean.Split(',');
                return new Vector3(
                    float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture)
                );
            }

            if (type == typeof(Vector2))
            {
                var clean = valStr.Replace("(", "").Replace(")", "").Trim();
                var parts = clean.Split(',');
                return new Vector2(
                    float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture)
                );
            }

            if (type == typeof(Quaternion))
            {
                var clean = valStr.Replace("(", "").Replace(")", "").Trim();
                var parts = clean.Split(',');
                return new Quaternion(
                    float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture),
                    float.Parse(parts[3], System.Globalization.CultureInfo.InvariantCulture)
                );
            }

            if (type == typeof(Color))
            {
                Color color;
                if (ColorUtility.TryParseHtmlString(valStr, out color))
                    return color;
            }

            if (type.IsEnum)
            {
                return Enum.Parse(type, valStr, true);
            }

            return Convert.ChangeType(valStr, type);
        }

        private static string HandleSearchAssets(string filter)
        {
            try
            {
                if (string.IsNullOrEmpty(filter)) filter = "";
                var guids = AssetDatabase.FindAssets(filter);
                var sb = new StringBuilder();
                sb.Append("{\"success\":true,\"assets\":[");
                for (int i = 0; i < guids.Length; i++)
                {
                    if (i > 0) sb.Append(",");
                    string path = AssetDatabase.GUIDToAssetPath(guids[i]);
                    string typeName = AssetDatabase.GetMainAssetTypeAtPath(path)?.Name ?? "Unknown";
                    sb.Append("{");
                    sb.Append($"\"guid\":\"{guids[i]}\",");
                    sb.Append($"\"path\":{JsonEscape(path)},");
                    sb.Append($"\"type\":\"{typeName}\"");
                    sb.Append("}");
                }
                sb.Append("]}");
                return sb.ToString();
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        private static string HandleBindScriptComponent(int instanceId, string className)
        {
            try
            {
                if (string.IsNullOrEmpty(className))
                {
                    return "{\"success\":false,\"error\":\"Class name is empty\"}";
                }

                var go = EditorUtility.InstanceIDToObject(instanceId) as GameObject;
                if (go == null)
                {
                    // Maybe check by instance ID directly or reload
                    return "{\"success\":false,\"error\":\"GameObject not found\"}";
                }

                var type = FindType(className);
                if (type == null)
                {
                    AssetDatabase.Refresh();
                    type = FindType(className);
                }

                if (type == null)
                {
                    return $"{{\"success\":false,\"error\":\"Class '{className}' could not be found. Ensure there are no compile errors and it is a valid class name.\"}}";
                }

                if (!typeof(Component).IsAssignableFrom(type))
                {
                    return $"{{\"success\":false,\"error\":\"Class '{className}' is not a subclass of Component/MonoBehaviour and cannot be added.\"}}";
                }

                Undo.RecordObject(go, $"Add Component {className}");
                var comp = go.AddComponent(type);
                EditorUtility.SetDirty(go);

                return $"{{\"success\":true,\"instanceId\":{instanceId},\"className\":\"{className}\",\"componentId\":{comp.GetInstanceID()}}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":{JsonEscape(ex.Message)}}}";
            }
        }

        public static string JsonEscape(string str)
        {
            if (string.IsNullOrEmpty(str)) return "\"\"";
            StringBuilder sb = new StringBuilder();
            sb.Append('"');
            foreach (char c in str)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        int codepoint = Convert.ToInt32(c);
                        if (codepoint < 32 || codepoint > 126)
                        {
                            sb.Append($"\\u{codepoint:X4}");
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }
    }
}
