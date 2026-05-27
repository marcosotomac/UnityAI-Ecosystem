export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unity AI Ecosystem</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --panel: #121214;
            --border: #1f1f23;
            --text: #e4e4e7;
            --muted: #71717a;
            --accent: #f4f4f5;
            --success: #22c55e;
            --warning: #eab308;
            --danger: #ef4444;
            --code-font: 'JetBrains Mono', monospace;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            overflow: hidden;
            height: 100vh;
            font-size: 12px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 16px;
            background-color: var(--panel);
            border-bottom: 1px solid var(--border);
            height: 40px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--accent);
        }

        .logo-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background-color: var(--success);
        }

        .status-indicators {
            display: flex;
            gap: 12px;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            color: var(--muted);
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--muted);
        }

        .status-dot.online {
            background-color: var(--success);
        }

        .status-dot.offline {
            background-color: var(--danger);
        }

        /* Layout Grid */
        .dashboard-container {
            display: grid;
            grid-template-columns: 240px 1fr 300px;
            grid-template-rows: calc(100vh - 40px - 180px) 180px;
            height: calc(100vh - 40px);
        }

        /* Panel Structure */
        .panel {
            background-color: var(--panel);
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #16161a;
            height: 32px;
        }

        .panel-title {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--muted);
        }

        .panel-content {
            padding: 12px;
            overflow-y: auto;
            flex: 1;
        }

        /* Sidebar Left */
        .sidebar-left {
            grid-column: 1;
            grid-row: 1 / 3;
            border-top: none;
            border-left: none;
            border-bottom: none;
        }

        .menu-section {
            margin-bottom: 16px;
        }

        .menu-title {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--muted);
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--border);
        }

        .btn {
            background-color: transparent;
            color: var(--text);
            border: 1px solid var(--border);
            padding: 6px 10px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.1s ease;
            width: 100%;
            margin-bottom: 4px;
        }

        .btn:hover {
            background-color: var(--border);
            color: var(--accent);
        }

        .btn-primary {
            background-color: var(--accent);
            border-color: var(--accent);
            color: var(--bg);
            font-weight: 500;
        }

        .btn-primary:hover {
            background-color: #ffffff;
            border-color: #ffffff;
            color: #000000;
        }

        .btn-secondary {
            border-color: rgba(234, 179, 8, 0.4);
            color: var(--warning);
        }

        .btn-secondary:hover {
            background-color: rgba(234, 179, 8, 0.08);
        }

        /* Main Workspace */
        .main-workspace {
            grid-column: 2;
            grid-row: 1;
            border-top: none;
            border-bottom: none;
            display: grid;
            grid-template-rows: 1fr 140px;
        }

        .scene-container {
            padding: 12px;
            overflow-y: auto;
            border-bottom: 1px solid var(--border);
        }

        /* Minimal File Tree */
        .tree-node {
            margin-left: 10px;
        }

        .tree-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 6px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            user-select: none;
        }

        .tree-header:hover {
            background-color: rgba(255, 255, 255, 0.02);
        }

        .tree-header.selected {
            background-color: rgba(255, 255, 255, 0.04);
            color: var(--accent);
            font-weight: 500;
        }

        .tree-toggle {
            width: 8px;
            height: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            color: var(--muted);
        }

        .tree-children {
            display: none;
            border-left: 1px solid var(--border);
            margin-left: 3px;
            padding-left: 6px;
        }

        .tree-children.expanded {
            display: block;
        }

        .gameobject-icon {
            color: var(--muted);
            font-size: 9px;
        }

        .gameobject-icon.inactive {
            opacity: 0.25;
        }

        /* Charts / Profiler Area */
        .profiler-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding: 12px;
            background-color: #0b0b0c;
        }

        .chart-box {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 3px;
            padding: 8px;
            display: flex;
            flex-direction: column;
        }

        .chart-title {
            font-size: 9px;
            color: var(--muted);
            font-weight: 600;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
            letter-spacing: 0.3px;
        }

        .chart-value {
            color: var(--accent);
        }

        canvas {
            width: 100%;
            height: 75px;
        }

        /* Sidebar Right (Inspector) */
        .sidebar-right {
            grid-column: 3;
            grid-row: 1 / 3;
            border-top: none;
            border-right: none;
            border-bottom: none;
        }

        .inspector-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--muted);
            gap: 8px;
            font-size: 11px;
            text-align: center;
            padding: 20px;
        }

        .inspector-icon {
            font-size: 16px;
            color: var(--border);
        }

        .component-card {
            border: 1px solid var(--border);
            background-color: #0c0c0e;
            border-radius: 2px;
            margin-bottom: 8px;
            overflow: hidden;
        }

        .component-header {
            background-color: rgba(255, 255, 255, 0.02);
            padding: 5px 10px;
            font-size: 10px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            color: var(--accent);
        }

        .component-properties {
            padding: 6px 10px;
        }

        .property-row {
            display: grid;
            grid-template-columns: 100px 1fr;
            font-size: 10px;
            padding: 3px 0;
            border-bottom: 1px solid var(--border);
            font-family: var(--code-font);
        }

        .property-row:last-child {
            border-bottom: none;
        }

        .property-name {
            color: var(--muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .property-value {
            color: var(--text);
            word-break: break-all;
        }

        /* Bottom Panel (Logs Console) */
        .bottom-console {
            grid-column: 2;
            grid-row: 2;
            border-left: none;
            border-right: none;
            border-bottom: none;
        }

        .log-list {
            font-family: var(--code-font);
            font-size: 10px;
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .log-row {
            padding: 3px 6px;
            display: flex;
            gap: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.005);
        }

        .log-row:hover {
            background-color: rgba(255, 255, 255, 0.015);
        }

        .log-time {
            color: var(--muted);
            width: 55px;
            flex-shrink: 0;
        }

        .log-type-tag {
            width: 45px;
            flex-shrink: 0;
            font-weight: 700;
            text-transform: uppercase;
        }

        .log-type-Log { color: var(--success); }
        .log-type-Warning { color: var(--warning); }
        .log-type-Error { color: var(--danger); }
        .log-type-Exception { color: var(--danger); }

        .log-msg {
            color: var(--text);
            white-space: pre-wrap;
            word-break: break-all;
        }

        /* Screenshot Container */
        .screenshot-container {
            width: 100%;
            height: 100px;
            border: 1px solid var(--border);
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 6px;
            overflow: hidden;
            position: relative;
            background-color: #08080a;
        }

        .screenshot-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .screenshot-placeholder {
            font-size: 10px;
            color: var(--muted);
        }

        .loader {
            border: 1.5px solid rgba(255, 255, 255, 0.05);
            border-radius: 50%;
            border-top: 1.5px solid var(--accent);
            width: 12px;
            height: 12px;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .custom-scroll::-webkit-scrollbar {
            width: 3px;
            height: 3px;
        }
        .custom-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 1px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: var(--muted);
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">
            <div class="logo-dot"></div>
            UNITY AI
        </div>
        <div class="status-indicators">
            <div class="status-badge">
                <span class="status-dot" id="unity-status-dot"></span>
                BRIDGE
            </div>
            <div class="status-badge">
                <span class="status-dot" id="quest-status-dot"></span>
                QUEST
            </div>
        </div>
    </header>

    <div class="dashboard-container">
        <!-- LEFT: Quest Tools -->
        <aside class="panel sidebar-left">
            <div class="panel-header">
                <div class="panel-title">Devices & Builds</div>
            </div>
            <div class="panel-content custom-scroll" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="menu-section">
                    <div class="menu-title">ADB status</div>
                    <button class="btn" id="btn-adb-devices">Scan Devices</button>
                    <div id="adb-devices-output" style="font-size: 10px; color: var(--muted); margin-top: 4px; font-family: var(--code-font);">Offline</div>
                </div>

                <div class="menu-section">
                    <div class="menu-title">Deployment</div>
                    <button class="btn btn-primary" id="btn-quest-install">Install APK</button>
                    <button class="btn" id="btn-quest-launch">Launch App</button>
                </div>

                <div class="menu-section">
                    <div class="menu-title">Viewport Capture</div>
                    <button class="btn" id="btn-quest-screenshot">Pull Screenshot</button>
                    <div class="screenshot-container" id="screenshot-box">
                        <div class="screenshot-placeholder" id="screenshot-text">No view captured</div>
                        <img src="" class="screenshot-img" id="screenshot-img" style="display:none;" />
                    </div>
                </div>

                <div class="menu-section">
                    <div class="menu-title">Quest System Logs</div>
                    <button class="btn btn-secondary" id="btn-quest-logs">Get Logcat</button>
                </div>
            </div>
        </aside>

        <!-- CENTER WORKSPACE: Hierarchy & Charts -->
        <main class="main-workspace">
            <!-- Scene Hierarchy -->
            <div class="scene-container custom-scroll">
                <div class="panel-header" style="padding: 0 0 4px 0; margin-bottom: 8px; background: transparent; border-bottom: 1px solid var(--border);">
                    <div class="panel-title">Hierarchy</div>
                    <button class="btn" id="btn-refresh-hierarchy" style="width: auto; padding: 2px 8px; font-size: 10px; margin-bottom: 0; border-radius: 2px;">Refresh</button>
                </div>
                <div id="scene-tree-root">Awaiting scene context...</div>
            </div>

            <!-- Charts & Performance -->
            <div class="profiler-container">
                <div class="chart-box">
                    <div class="chart-title">
                        <span>FRAMERATE</span>
                        <span class="chart-value" id="fps-val">0.0 FPS</span>
                    </div>
                    <canvas id="fps-chart"></canvas>
                </div>
                <div class="chart-box">
                    <div class="chart-title">
                        <span>GC ALLOCATIONS</span>
                        <span class="chart-value" id="gc-val">0.0 KB</span>
                    </div>
                    <canvas id="gc-chart"></canvas>
                </div>
            </div>
        </main>

        <!-- RIGHT: Component Inspector -->
        <aside class="panel sidebar-right">
            <div class="panel-header">
                <div class="panel-title">Inspector</div>
                <button class="btn" id="btn-editor-focus" style="width: auto; padding: 2px 8px; font-size: 10px; margin-bottom: 0; border-radius: 2px; display: none;">Focus</button>
            </div>
            <div class="panel-content custom-scroll" id="inspector-content">
                <div class="inspector-placeholder">
                    <div class="inspector-icon">◈</div>
                    Select an object in the tree to inspect serialized properties.
                </div>
            </div>
        </aside>

        <!-- BOTTOM Console Logs -->
        <footer class="panel bottom-console">
            <div class="panel-header">
                <div class="panel-title">Console logs</div>
                <button class="btn" id="btn-clear-logs" style="width: auto; padding: 2px 8px; font-size: 10px; margin-bottom: 0; border-radius: 2px;">Clear</button>
            </div>
            <div class="panel-content custom-scroll" id="logs-container">
                <div class="log-list" id="log-list-content">
                    <div class="log-row">
                        <span class="log-time">00:00:00</span>
                        <span class="log-type-tag log-type-Log">[SYS]</span>
                        <span class="log-msg">Active console listener stream initialized.</span>
                    </div>
                </div>
            </div>
        </footer>
    </div>

    <script>
        const UNITY_PORT = 3024;
        const DASHBOARD_PORT = 3025;
        const UNITY_URL = \`http://localhost:\${UNITY_PORT}\`;

        let selectedInstanceId = null;
        let isConnectedToUnity = false;

        const fpsHistory = Array(60).fill(0);
        const gcHistory = Array(60).fill(0);

        const fpsCanvas = document.getElementById('fps-chart');
        const gcCanvas = document.getElementById('gc-chart');
        const fpsCtx = fpsCanvas.getContext('2d');
        const gcCtx = gcCanvas.getContext('2d');

        function resizeCanvas() {
            fpsCanvas.width = fpsCanvas.parentElement.clientWidth - 16;
            gcCanvas.width = gcCanvas.parentElement.clientWidth - 16;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function drawChart(ctx, data, color, maxVal = 60) {
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;
            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = '#1e1e24';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < width; i += width / 6) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
                ctx.stroke();
            }
            for (let i = 0; i < height; i += height / 4) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
                ctx.stroke();
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            const step = width / (data.length - 1);
            for (let i = 0; i < data.length; i++) {
                const val = data[i];
                const x = i * step;
                const ratio = maxVal > 0 ? val / maxVal : 0;
                const y = height - (Math.min(ratio, 1.0) * (height - 8)) - 4;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        async function callUnity(action, params = {}) {
            try {
                const response = await fetch(UNITY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, ...params })
                });
                return await response.json();
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        async function callLocalApi(endpoint, params = {}) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                return await response.json();
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        async function updatePerformance() {
            if (!isConnectedToUnity) {
                setUnityStatus(false);
                return;
            }

            const metrics = await callUnity('get_performance_metrics');
            if (metrics.success) {
                setUnityStatus(true);
            } else {
                setUnityStatus(false);
                return;
            }

            const profiler = await callUnity('get_profiler_report');
            if (profiler.success) {
                const fps = parseFloat(profiler.averageFPS) || 0;
                const gc = parseFloat(profiler.averageGCAllocKb) || 0;

                document.getElementById('fps-val').innerText = fps.toFixed(1) + ' FPS';
                document.getElementById('gc-val').innerText = gc.toFixed(1) + ' KB';

                fpsHistory.push(fps);
                fpsHistory.shift();

                gcHistory.push(gc);
                gcHistory.shift();

                drawChart(fpsCtx, fpsHistory, '#e4e4e7', 90);
                const maxGc = Math.max(...gcHistory, 50);
                drawChart(gcCtx, gcHistory, '#71717a', maxGc);
            }
        }

        function setUnityStatus(online) {
            isConnectedToUnity = online;
            const dot = document.getElementById('unity-status-dot');
            if (online) {
                dot.className = 'status-dot online';
            } else {
                dot.className = 'status-dot offline';
                document.getElementById('fps-val').innerText = '0.0 FPS';
                document.getElementById('gc-val').innerText = '0.0 KB';
            }
        }

        async function refreshHierarchy() {
            const root = document.getElementById('scene-tree-root');
            if (!isConnectedToUnity) {
                root.innerHTML = '<span style="color: var(--danger)">✖ Bridge inactive. Start server in Unity Editor.</span>';
                return;
            }

            root.innerHTML = '<div style="display: flex; gap: 6px; align-items: center;"><div class="loader"></div> Loading tree...</div>';
            const data = await callUnity('get_hierarchy');
            if (data.success && data.hierarchy) {
                root.innerHTML = '';
                data.hierarchy.forEach(node => {
                    root.appendChild(createTreeNode(node));
                });
            } else {
                root.innerHTML = '<span style="color: var(--danger)">Failed to read scene tree.</span>';
            }
        }

        function createTreeNode(node) {
            const container = document.createElement('div');
            container.className = 'tree-node';

            const header = document.createElement('div');
            header.className = 'tree-header';
            if (selectedInstanceId === node.instanceId) {
                header.classList.add('selected');
            }

            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            toggle.innerHTML = node.children && node.children.length > 0 ? '▼' : '&nbsp;&nbsp;';

            const icon = document.createElement('span');
            icon.className = 'gameobject-icon';
            icon.innerHTML = '• ';
            if (!node.active) {
                icon.classList.add('inactive');
            }

            const name = document.createElement('span');
            name.innerText = node.name;
            name.style.opacity = node.active ? '1.0' : '0.4';

            header.appendChild(toggle);
            header.appendChild(icon);
            header.appendChild(name);
            container.appendChild(header);

            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children expanded';
            
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    childrenContainer.appendChild(createTreeNode(child));
                });
                container.appendChild(childrenContainer);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    childrenContainer.classList.toggle('expanded');
                    toggle.innerText = childrenContainer.classList.contains('expanded') ? '▼' : '▶';
                };
            }

            header.onclick = async () => {
                document.querySelectorAll('.tree-header').forEach(h => h.classList.remove('selected'));
                header.classList.add('selected');
                selectedInstanceId = node.instanceId;
                document.getElementById('btn-editor-focus').style.display = 'inline-block';
                await selectObject(node.instanceId);
            };

            return container;
        }

        async function selectObject(instanceId) {
            const inspector = document.getElementById('inspector-content');
            inspector.innerHTML = '<div style="display: flex; gap: 6px; align-items: center;"><div class="loader"></div> Querying...</div>';
            
            await callUnity('select_object', { instanceId, fieldValue: 'false' });

            const data = await callUnity('get_details', { instanceId });
            if (data.success) {
                inspector.innerHTML = '';
                
                const summary = document.createElement('div');
                summary.style.marginBottom = '10px';
                summary.innerHTML = \`
                    <h3 style="font-size: 11px; font-weight:600; color:var(--accent);">\${data.name}</h3>
                    <p style="font-size: 9px; color: var(--muted); margin-top:2px;">ID: \${data.instanceId} | Tag: \${data.tag} | Layer: \${data.layer}</p>
                \`;
                inspector.appendChild(summary);

                data.components.forEach(comp => {
                    const card = document.createElement('div');
                    card.className = 'component-card';

                    const cHeader = document.createElement('div');
                    cHeader.className = 'component-header';
                    const parts = comp.type.split('.');
                    cHeader.innerText = parts[parts.length - 1];
                    card.appendChild(cHeader);

                    const props = document.createElement('div');
                    props.className = 'component-properties';

                    const allProps = { ...comp.fields, ...comp.properties };
                    const keys = Object.keys(allProps);
                    
                    if (keys.length === 0) {
                        props.innerHTML = '<div style="font-size: 9px; color: var(--muted); font-style:italic;">No data fields</div>';
                    } else {
                        keys.forEach(key => {
                            const row = document.createElement('div');
                            row.className = 'property-row';
                            row.innerHTML = \`
                                <span class="property-name" title="\${key}">\${key}</span>
                                <span class="property-value">\${allProps[key]}</span>
                            \`;
                            props.appendChild(row);
                        });
                    }
                    card.appendChild(props);
                    inspector.appendChild(card);
                });
            } else {
                inspector.innerHTML = '<span style="color: var(--danger)">Inspector error.</span>';
            }
        }

        async function fetchLogs() {
            if (!isConnectedToUnity) return;
            const data = await callUnity('get_logs');
            if (data.success && data.logs) {
                renderLogs(data.logs);
            }
        }

        function renderLogs(logs) {
            const list = document.getElementById('log-list-content');
            list.innerHTML = '';
            if (logs.length === 0) {
                list.innerHTML = '<div style="color: var(--muted); padding: 8px;">Logs cleared.</div>';
                return;
            }
            logs.forEach(entry => {
                const row = document.createElement('div');
                row.className = 'log-row';
                
                const time = document.createElement('span');
                time.className = 'log-time';
                time.innerText = entry.time || '00:00:00';

                const type = document.createElement('span');
                type.className = \`log-type-tag log-type-\${entry.type}\`;
                type.innerText = \`[\${entry.type.substring(0, 3)}]\`;

                const msg = document.createElement('span');
                msg.className = 'log-msg';
                msg.innerText = entry.log;

                row.appendChild(time);
                row.appendChild(type);
                row.appendChild(msg);
                list.appendChild(row);
            });
            const container = document.getElementById('logs-container');
            container.scrollTop = container.scrollHeight;
        }

        function connectWebSocket() {
            try {
                const ws = new WebSocket(\`ws://localhost:\${UNITY_PORT}/ws/\`);
                
                ws.onopen = () => {
                    setUnityStatus(true);
                    refreshHierarchy();
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.event === 'selection_changed') {
                            selectedInstanceId = data.instanceId;
                            if (data.instanceId !== 0) {
                                selectObject(data.instanceId);
                            }
                            refreshHierarchy();
                        } else if (data.event === 'log_received') {
                            fetchLogs();
                        }
                    } catch (e) {}
                };

                ws.onclose = () => {
                    setUnityStatus(false);
                    setTimeout(connectWebSocket, 3000);
                };

                ws.onprimary = () => {
                    setUnityStatus(false);
                };
            } catch (e) {
                setUnityStatus(false);
                setTimeout(connectWebSocket, 3000);
            }
        }

        document.getElementById('btn-adb-devices').onclick = async () => {
            const out = document.getElementById('adb-devices-output');
            out.innerText = 'Scanning...';
            const data = await callLocalApi('/api/adb/devices');
            if (data.success) {
                const dot = document.getElementById('quest-status-dot');
                if (data.devices && data.devices.length > 0) {
                    dot.className = 'status-dot online';
                    out.innerHTML = data.devices.map(d => \`<div>● \${d.id} (\${d.state})</div>\`).join('');
                } else {
                    dot.className = 'status-dot offline';
                    out.innerText = 'Offline';
                }
            } else {
                out.innerText = 'Error: ' + data.error;
            }
        };

        document.getElementById('btn-quest-install').onclick = async () => {
            const btn = document.getElementById('btn-quest-install');
            const originalText = btn.innerText;
            btn.innerText = 'Installing...';
            btn.disabled = true;
            const data = await callLocalApi('/api/adb/install');
            btn.innerText = originalText;
            btn.disabled = false;
            alert(data.success ? 'APK installed successfully!' : 'Installation failed: ' + data.error);
        };

        document.getElementById('btn-quest-launch').onclick = async () => {
            const data = await callLocalApi('/api/adb/launch');
            alert(data.success ? 'Launch triggered!' : 'Launch failed: ' + data.error);
        };

        document.getElementById('btn-quest-screenshot').onclick = async () => {
            const box = document.getElementById('screenshot-box');
            const img = document.getElementById('screenshot-img');
            const text = document.getElementById('screenshot-text');

            text.innerHTML = '<div style="display: flex; gap: 6px; align-items: center; justify-content:center;"><div class="loader"></div></div>';
            img.style.display = 'none';

            const data = await callLocalApi('/api/adb/screenshot');
            if (data.success && data.image) {
                text.style.display = 'none';
                img.src = 'data:image/png;base64,' + data.image;
                img.style.display = 'block';
            } else {
                text.innerText = 'Capture failed: ' + data.error;
            }
        };

        document.getElementById('btn-quest-logs').onclick = async () => {
            const data = await callLocalApi('/api/adb/logs');
            if (data.success) {
                const logsList = data.logs.map(log => ({
                    time: new Date().toLocaleTimeString(),
                    type: log.includes('E/') ? 'Error' : log.includes('W/') ? 'Warning' : 'Log',
                    log: log
                }));
                renderLogs(logsList);
            } else {
                alert('Quest logcat failed: ' + data.error);
            }
        };

        document.getElementById('btn-refresh-hierarchy').onclick = refreshHierarchy;
        
        document.getElementById('btn-editor-focus').onclick = () => {
            if (selectedInstanceId) {
                callUnity('select_object', { instanceId: selectedInstanceId, fieldValue: 'true' });
            }
        };

        document.getElementById('btn-clear-logs').onclick = async () => {
            await callUnity('clear_logs');
            fetchLogs();
        };

        connectWebSocket();
        setInterval(updatePerformance, 1000);
        setInterval(() => {
            if (isConnectedToUnity) {
                fetchLogs();
            }
        }, 3000);

        (async () => {
            const ping = await callUnity('ping');
            if (ping.success) {
                setUnityStatus(true);
                refreshHierarchy();
                fetchLogs();
            }
        })();
    </script>
</body>
</html>`;
