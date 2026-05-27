export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unity AI Developer Ecosystem - Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0d1117;
            --panel-bg: #161b22;
            --panel-header-bg: #21262d;
            --border-color: #30363d;
            --primary: #58a6ff;
            --success: #2ea44f;
            --warning: #d29922;
            --danger: #f85149;
            --text-main: #c9d1d9;
            --text-muted: #8b949e;
            --text-highlight: #f0f6fc;
            --terminal-bg: #010409;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'JetBrains Mono', monospace;
            background-color: var(--bg-color);
            color: var(--text-main);
            overflow: hidden;
            height: 100vh;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 16px;
            background-color: var(--panel-bg);
            border-bottom: 1px solid var(--border-color);
            height: 48px;
            z-index: 10;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 0.85rem;
            letter-spacing: 0.5px;
            color: var(--text-highlight);
        }

        .logo-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: var(--primary);
        }

        .status-indicators {
            display: flex;
            gap: 12px;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.7rem;
            font-weight: 600;
            padding: 4px 10px;
            background: var(--panel-header-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-main);
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: var(--text-muted);
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
            grid-template-columns: 260px 1fr 320px;
            grid-template-rows: calc(100vh - 48px - 200px) 200px;
            height: calc(100vh - 48px);
        }

        /* Panel Structure */
        .panel {
            background-color: var(--panel-bg);
            border: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-header {
            padding: 8px 16px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--panel-header-bg);
            height: 36px;
        }

        .panel-title {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
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
            margin-bottom: 20px;
        }

        .menu-title {
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            margin-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 4px;
        }

        .btn {
            background-color: var(--panel-header-bg);
            color: var(--text-main);
            border: 1px solid var(--border-color);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: background-color 0.1s ease, border-color 0.1s ease;
            width: 100%;
            margin-bottom: 6px;
        }

        .btn:hover {
            background-color: var(--border-color);
            border-color: var(--text-muted);
            color: var(--text-highlight);
        }

        .btn:active {
            background-color: var(--panel-bg);
        }

        .btn-primary {
            background-color: #238636;
            border-color: rgba(240, 246, 252, 0.1);
            color: #ffffff;
        }

        .btn-primary:hover {
            background-color: var(--success);
            border-color: var(--success);
        }

        .btn-secondary {
            background-color: rgba(212, 153, 34, 0.15);
            border-color: rgba(212, 153, 34, 0.3);
            color: #f1e05a;
        }

        .btn-secondary:hover {
            background-color: var(--warning);
            border-color: var(--warning);
            color: #000;
        }

        /* Main Workspace */
        .main-workspace {
            grid-column: 2;
            grid-row: 1;
            border-top: none;
            border-bottom: none;
            display: grid;
            grid-template-rows: 1fr 160px;
        }

        .scene-container {
            padding: 12px;
            overflow-y: auto;
            border-bottom: 1px solid var(--border-color);
        }

        /* VS Code Style File Tree */
        .tree-node {
            margin-left: 12px;
            position: relative;
        }

        .tree-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
            user-select: none;
            transition: background-color 0.1s ease;
        }

        .tree-header:hover {
            background-color: var(--panel-header-bg);
        }

        .tree-header.selected {
            background-color: #21262d;
            border-left: 2px solid var(--primary);
            color: var(--text-highlight);
        }

        .tree-toggle {
            width: 10px;
            height: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.5rem;
            color: var(--text-muted);
        }

        .tree-children {
            display: none;
            border-left: 1px solid var(--border-color);
            margin-left: 5px;
            padding-left: 6px;
        }

        .tree-children.expanded {
            display: block;
        }

        .gameobject-icon {
            color: var(--text-muted);
            font-size: 0.75rem;
        }

        .gameobject-icon.inactive {
            opacity: 0.35;
        }

        /* Charts / Profiler Area */
        .profiler-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding: 12px;
            background-color: var(--bg-color);
        }

        .chart-box {
            position: relative;
            background: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 8px;
            display: flex;
            flex-direction: column;
        }

        .chart-title {
            font-size: 0.65rem;
            color: var(--text-muted);
            font-weight: 700;
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
        }

        .chart-value {
            color: var(--text-highlight);
            font-weight: 700;
        }

        canvas {
            width: 100%;
            height: 90px;
            background-color: transparent;
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
            color: var(--text-muted);
            gap: 12px;
            font-size: 0.7rem;
            text-align: center;
            padding: 20px;
        }

        .inspector-icon {
            font-size: 1.8rem;
            color: var(--border-color);
        }

        .component-card {
            border: 1px solid var(--border-color);
            background-color: var(--bg-color);
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
        }

        .component-header {
            background-color: var(--panel-header-bg);
            padding: 6px 12px;
            font-size: 0.7rem;
            font-weight: 700;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-highlight);
        }

        .component-properties {
            padding: 8px 12px;
        }

        .property-row {
            display: grid;
            grid-template-columns: 110px 1fr;
            font-size: 0.65rem;
            padding: 4px 0;
            border-bottom: 1px solid var(--border-color);
        }

        .property-row:last-child {
            border-bottom: none;
        }

        .property-name {
            color: var(--text-muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .property-value {
            color: #d19a66;
            word-break: break-all;
            font-weight: 500;
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
            font-size: 0.65rem;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .log-row {
            padding: 4px 8px;
            border-radius: 2px;
            display: flex;
            gap: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.01);
        }

        .log-row:hover {
            background-color: var(--panel-header-bg);
        }

        .log-time {
            color: var(--text-muted);
            width: 60px;
            flex-shrink: 0;
        }

        .log-type-badge {
            width: 55px;
            flex-shrink: 0;
            text-align: center;
            font-weight: 700;
            border-radius: 2px;
            padding: 0 4px;
            font-size: 0.55rem;
        }

        .log-type-Log { background-color: rgba(46, 164, 79, 0.15); color: #58d68d; }
        .log-type-Warning { background-color: rgba(210, 153, 34, 0.15); color: #f5b041; }
        .log-type-Error { background-color: rgba(248, 81, 73, 0.15); color: #ec7063; }
        .log-type-Exception { background-color: rgba(248, 81, 73, 0.15); color: #ec7063; }

        .log-msg {
            color: var(--text-main);
            white-space: pre-wrap;
            word-break: break-all;
        }

        /* Screenshot Container */
        .screenshot-container {
            width: 100%;
            height: 120px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 8px;
            overflow: hidden;
            position: relative;
            background-color: var(--terminal-bg);
        }

        .screenshot-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .screenshot-placeholder {
            font-size: 0.65rem;
            color: var(--text-muted);
            text-align: center;
        }

        .loader {
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top: 2px solid var(--primary);
            width: 14px;
            height: 14px;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .custom-scroll::-webkit-scrollbar {
            width: 4px;
            height: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 2px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
            background: var(--text-muted);
        }
    </style>
</head>
<body>
    <header>
        <div class="logo">
            <div class="logo-dot"></div>
            UNITY AI ECOSYSTEM
        </div>
        <div class="status-indicators">
            <div class="status-badge">
                <span class="status-dot" id="unity-status-dot"></span>
                Unity Bridge (3024)
            </div>
            <div class="status-badge">
                <span class="status-dot" id="quest-status-dot"></span>
                ADB Quest
            </div>
        </div>
    </header>

    <div class="dashboard-container">
        <!-- LEFT: Quest Tools -->
        <aside class="panel sidebar-left">
            <div class="panel-header">
                <div class="panel-title">VR Deployment</div>
            </div>
            <div class="panel-content custom-scroll" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="menu-section">
                    <div class="menu-title">ADB Devices</div>
                    <button class="btn" id="btn-adb-devices">Scan devices</button>
                    <div id="adb-devices-output" style="font-size: 0.6rem; color: var(--text-muted); margin-top: 6px;">No scan history.</div>
                </div>

                <div class="menu-section">
                    <div class="menu-title">Build Pipeline</div>
                    <button class="btn btn-primary" id="btn-quest-install">Install APK</button>
                    <button class="btn" id="btn-quest-launch">Run App</button>
                </div>

                <div class="menu-section">
                    <div class="menu-title">Visual Capture</div>
                    <button class="btn" id="btn-quest-screenshot">Capture Headset View</button>
                    <div class="screenshot-container" id="screenshot-box">
                        <div class="screenshot-placeholder" id="screenshot-text">No screenshot captured</div>
                        <img src="" class="screenshot-img" id="screenshot-img" style="display:none;" />
                    </div>
                </div>

                <div class="menu-section">
                    <div class="menu-title">System Logs</div>
                    <button class="btn btn-secondary" id="btn-quest-logs">Get Headset Logs</button>
                </div>
            </div>
        </aside>

        <!-- CENTER WORKSPACE: Hierarchy & Charts -->
        <main class="main-workspace">
            <!-- Scene Hierarchy -->
            <div class="scene-container custom-scroll">
                <div class="panel-header" style="padding: 0 0 8px 0; margin-bottom: 12px; background: transparent; border-bottom: 1px solid var(--border-color);">
                    <div class="panel-title">Scene Hierarchy</div>
                    <button class="btn" id="btn-refresh-hierarchy" style="width: auto; padding: 4px 10px; font-size: 0.65rem; margin-bottom: 0;">Refresh Tree</button>
                </div>
                <div id="scene-tree-root">Awaiting active editor connection...</div>
            </div>

            <!-- Charts & Performance -->
            <div class="profiler-container">
                <div class="chart-box">
                    <div class="chart-title">
                        <span>CPU FRAME TIME (FPS)</span>
                        <span class="chart-value" id="fps-val">0.0 FPS</span>
                    </div>
                    <canvas id="fps-chart"></canvas>
                </div>
                <div class="chart-box">
                    <div class="chart-title">
                        <span>GC ALLOCATIONS (HEAP)</span>
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
                <button class="btn" id="btn-editor-focus" style="width: auto; padding: 4px 10px; font-size: 0.65rem; margin-bottom: 0; display: none;">Focus in Scene</button>
            </div>
            <div class="panel-content custom-scroll" id="inspector-content">
                <div class="inspector-placeholder">
                    <div class="inspector-icon">🔍</div>
                    Select a GameObject in the scene tree to inspect serialized components and properties.
                </div>
            </div>
        </aside>

        <!-- BOTTOM Console Logs -->
        <footer class="panel bottom-console">
            <div class="panel-header">
                <div class="panel-title">Console logs</div>
                <button class="btn" id="btn-clear-logs" style="width: auto; padding: 4px 10px; font-size: 0.65rem; margin-bottom: 0;">Clear</button>
            </div>
            <div class="panel-content custom-scroll" id="logs-container">
                <div class="log-list" id="log-list-content">
                    <div class="log-row">
                        <span class="log-time">00:00:00</span>
                        <span class="log-type-badge log-type-Log">BRIDGE</span>
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

            ctx.strokeStyle = '#21262d';
            ctx.lineWidth = 1;
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
                const y = height - (Math.min(ratio, 1.0) * (height - 10)) - 5;
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

                drawChart(fpsCtx, fpsHistory, '#58a6ff', 90);
                const maxGc = Math.max(...gcHistory, 50);
                drawChart(gcCtx, gcHistory, '#d29922', maxGc);
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
                root.innerHTML = '<span style="color: var(--danger)">✖ Unity Bridge inactive. Confirm server status in Editor.</span>';
                return;
            }

            root.innerHTML = '<div style="display: flex; gap: 8px; align-items: center;"><div class="loader"></div> Querying hierarchy...</div>';
            const data = await callUnity('get_hierarchy');
            if (data.success && data.hierarchy) {
                root.innerHTML = '';
                data.hierarchy.forEach(node => {
                    root.appendChild(createTreeNode(node));
                });
            } else {
                root.innerHTML = '<span style="color: var(--danger)">Failed to read active scene hierarchy.</span>';
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
            icon.innerHTML = '❖ ';
            if (!node.active) {
                icon.classList.add('inactive');
            }

            const name = document.createElement('span');
            name.innerText = node.name;
            name.style.opacity = node.active ? '1.0' : '0.45';

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
            inspector.innerHTML = '<div style="display: flex; gap: 8px; align-items: center;"><div class="loader"></div> Reading fields...</div>';
            
            await callUnity('select_object', { instanceId, fieldValue: 'false' });

            const data = await callUnity('get_details', { instanceId });
            if (data.success) {
                inspector.innerHTML = '';
                
                const summary = document.createElement('div');
                summary.style.marginBottom = '12px';
                summary.innerHTML = \`
                    <h3 style="font-size: 0.8rem; font-weight:700; color:var(--text-highlight);">\${data.name}</h3>
                    <p style="font-size: 0.6rem; color: var(--text-muted); margin-top:2px;">Instance ID: \${data.instanceId} | Tag: \${data.tag} | Layer: \${data.layer}</p>
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
                        props.innerHTML = '<div style="font-size:0.6rem; color: var(--text-muted); font-style:italic;">No serializable data fields</div>';
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
                inspector.innerHTML = '<span style="color: var(--danger)">Failed to query component details.</span>';
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
                list.innerHTML = '<div style="color: var(--text-muted); padding: 8px;">Log buffer is empty.</div>';
                return;
            }
            logs.forEach(entry => {
                const row = document.createElement('div');
                row.className = 'log-row';
                
                const time = document.createElement('span');
                time.className = 'log-time';
                time.innerText = entry.time || '00:00:00';

                const type = document.createElement('span');
                type.className = \`log-type-badge log-type-\${entry.type}\`;
                type.innerText = entry.type.toUpperCase();

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

                ws.onerror = () => {
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
                    out.innerText = 'No connected devices';
                }
            } else {
                out.innerText = 'ADB Error: ' + data.error;
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
            alert(data.success ? 'App launch triggered!' : 'Launch failed: ' + data.error);
        };

        document.getElementById('btn-quest-screenshot').onclick = async () => {
            const box = document.getElementById('screenshot-box');
            const img = document.getElementById('screenshot-img');
            const text = document.getElementById('screenshot-text');

            text.innerHTML = '<div style="display: flex; gap: 8px; align-items: center; justify-content:center;"><div class="loader"></div> Pulling...</div>';
            img.style.display = 'none';

            const data = await callLocalApi('/api/adb/screenshot');
            if (data.success && data.image) {
                text.style.display = 'none';
                img.src = 'data:image/png;base64,' + data.image;
                img.style.display = 'block';
            } else {
                text.innerText = 'Screenshot failed: ' + data.error;
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
