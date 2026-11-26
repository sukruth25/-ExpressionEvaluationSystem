"""
Self-contained Web Interface for the Observatory's Expression Evaluation System.
Uses Python standard library http.server (zero third-party dependencies required).
"""

import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from observatory.processor import process_formula
from observatory.errors import ObservatoryError

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔭 Observatory Expression Evaluation System</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --accent: #58a6ff;
      --accent-hover: #1f6feb;
      --success: #3fb950;
      --error: #f85149;
      --warning: #d29922;
      --code-bg: #0b0e14;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 26px; color: #f0f6fc; display: flex; align-items: center; gap: 10px; }
    p.subtitle { color: #8b949e; font-size: 14px; margin-top: 4px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #f0f6fc; }
    input[type="text"] {
      width: 100%;
      padding: 10px 14px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #f0f6fc;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 15px;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
    }
    .preset-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
    .preset-label { font-size: 13px; color: #8b949e; }
    .btn-preset {
      background: #21262d;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 4px 10px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-preset:hover { background: #30363d; border-color: #8b949e; color: #fff; }
    .actions { display: flex; gap: 12px; margin-top: 16px; }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-weight: 600;
      font-size: 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .result-banner {
      padding: 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .result-banner.success {
      background: rgba(63, 185, 80, 0.15);
      border: 1px solid var(--success);
      color: #7ee787;
    }
    .result-banner.error {
      background: rgba(248, 81, 73, 0.15);
      border: 1px solid var(--error);
      color: #ff7b72;
    }
    .result-val { font-size: 28px; font-weight: bold; }
    .result-label { font-size: 14px; color: #c9d1d9; }
    h2 { font-size: 18px; color: #f0f6fc; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #21262d; color: #f0f6fc; font-weight: 600; }
    tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-op { background: #1f6feb; color: #fff; }
    .badge-num { background: #238636; color: #fff; }
    .badge-var { background: #8957e5; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔭 The Observatory's Untrustworthy Formulas</h1>
      <p class="subtitle">Precise Expression Processing, AST Tree Visualization & Intermediate Calculation Trace System</p>
    </header>

    <div class="card">
      <div class="form-group">
        <label for="expr">Formula Expression</label>
        <input type="text" id="expr" value="-(a + b) * 2 + 30 / 5" placeholder="Enter mathematical formula...">
      </div>

      <div class="form-group">
        <label for="vars">Variables (comma-separated 'name = value')</label>
        <input type="text" id="vars" value="a = 10, b = 5" placeholder="e.g. a = 10, b = 5, airmass = 1.2">
      </div>

      <div class="preset-bar">
        <span class="preset-label">Presets:</span>
        <button class="btn-preset" onclick="loadPreset('-(a + b) * 2 + 30 / 5', 'a = 10, b = 5')">Illustrative Example (-24)</button>
        <button class="btn-preset" onclick="loadPreset('((flux_raw - -15.5) * -damping) / (airmass + (elevation / -45.0))', 'flux_raw = 24.5, damping = 2, airmass = 10.0, elevation = 270.0')">Nightly Deep Flux</button>
        <button class="btn-preset" onclick="loadPreset('50 / (zenith - 45)', 'zenith = 45')">Division by Zero</button>
        <button class="btn-preset" onclick="loadPreset('-(a + b * (c - 2)', 'a = 1, b = 2, c = 3')">Missing Bracket</button>
        <button class="btn-preset" onclick="loadPreset('100 * flux + $val', 'flux = 2')">Invalid Token ($)</button>
      </div>

      <div class="actions">
        <button class="btn-primary" onclick="calculateFormula()">Evaluate & Inspect Trace</button>
      </div>
    </div>

    <div id="result-container" style="display: none;">
      <!-- Result banner will be inserted here -->
      <div id="banner-slot"></div>

      <!-- Tree card -->
      <div class="card">
        <h2>🌳 Expression Tree Representation</h2>
        <pre id="tree-slot"></pre>
      </div>

      <!-- Shunting-Yard Trace -->
      <div class="card">
        <h2>🔄 Infix-to-Postfix (Shunting-Yard) Parsing Trace</h2>
        <p style="font-size: 13px; color: #8b949e; margin-bottom: 8px;">
          Postfix (RPN) Output: <strong id="postfix-slot" style="color: #58a6ff;"></strong>
        </p>
        <div style="overflow-x: auto;">
          <table id="sy-table">
            <thead>
              <tr>
                <th style="width: 50px;">Step</th>
                <th style="width: 80px;">Token</th>
                <th>Action Taken</th>
                <th style="width: 140px;">Operator Stack</th>
                <th>Output Queue</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Intermediate Calculations Trace -->
      <div class="card">
        <h2>🧮 Intermediate Calculations & Subexpression Trace</h2>
        <div style="overflow-x: auto;">
          <table id="eval-table">
            <thead>
              <tr>
                <th style="width: 50px;">Step</th>
                <th style="width: 80px;">Token</th>
                <th>Subexpression / Operation</th>
                <th style="width: 120px;">Sub-Result</th>
                <th>Evaluation Stack</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    function loadPreset(expression, variables) {
      document.getElementById('expr').value = expression;
      document.getElementById('vars').value = variables;
      calculateFormula();
    }

    async function calculateFormula() {
      const expr = document.getElementById('expr').value.trim();
      const rawVars = document.getElementById('vars').value.trim();

      const container = document.getElementById('result-container');
      const bannerSlot = document.getElementById('banner-slot');
      container.style.display = 'block';

      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expression: expr, variables_raw: rawVars })
        });
        const data = await res.json();

        if (!data.success) {
          bannerSlot.innerHTML = `
            <div class="result-banner error">
              <div>
                <div class="result-label">Rejection Reason</div>
                <div style="font-weight: 600; font-size: 16px; margin-top: 4px;">${data.error_message}</div>
                <pre style="margin-top: 10px; background: rgba(0,0,0,0.3); border: none;">${data.diagnostic || ''}</pre>
              </div>
            </div>
          `;
          document.getElementById('tree-slot').parentElement.style.display = 'none';
          document.getElementById('sy-table').parentElement.parentElement.style.display = 'none';
          document.getElementById('eval-table').parentElement.parentElement.style.display = 'none';
          return;
        }

        // Show sections
        document.getElementById('tree-slot').parentElement.style.display = 'block';
        document.getElementById('sy-table').parentElement.parentElement.style.display = 'block';
        document.getElementById('eval-table').parentElement.parentElement.style.display = 'block';

        // Success banner
        bannerSlot.innerHTML = `
          <div class="result-banner success">
            <div>
              <div class="result-label">Verified Accurate Result</div>
              <div class="result-val">${data.formatted_result}</div>
            </div>
            <div style="text-align: right; font-size: 13px; color: #c9d1d9;">
              Formula: <code>${data.expression}</code>
            </div>
          </div>
        `;

        // Tree
        document.getElementById('tree-slot').textContent = data.tree_text;

        // Postfix
        document.getElementById('postfix-slot').textContent = data.postfix_str;

        // Shunting Yard Table
        const syTbody = document.querySelector('#sy-table tbody');
        syTbody.innerHTML = '';
        data.shunting_trace.forEach(s => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${s.step_num}</td>
            <td><strong>${s.token_raw}</strong></td>
            <td>${s.action}</td>
            <td><code>${s.operator_stack.join(' ') || '(empty)'}</code></td>
            <td><code>${s.output_queue.join(' ') || '(empty)'}</code></td>
          `;
          syTbody.appendChild(row);
        });

        // Intermediate Calculations Table
        const evalTbody = document.querySelector('#eval-table tbody');
        evalTbody.innerHTML = '';
        data.eval_trace.forEach(s => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${s.step_num}</td>
            <td><strong>${s.token_raw}</strong></td>
            <td>${s.subexpression_evaluated}</td>
            <td style="color: #7ee787; font-weight: bold;">${s.result_value}</td>
            <td><code>${s.stack_state.join(', ') || '(empty)'}</code></td>
          `;
          evalTbody.appendChild(row);
        });

      } catch (err) {
        bannerSlot.innerHTML = `
          <div class="result-banner error">
            <div>Error communicating with evaluation server: ${err.message}</div>
          </div>
        `;
      }
    }

    // Auto calculate on load
    window.addEventListener('DOMContentLoaded', calculateFormula);
  </script>
</body>
</html>
"""


class ObservatoryHttpHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/evaluate":
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length)

            try:
                data = json.loads(post_body.decode("utf-8"))
                expression = data.get("expression", "")
                raw_vars = data.get("variables_raw", "")
                variables = {}

                if raw_vars:
                    from observatory_cli import parse_var_definitions
                    variables = parse_var_definitions([raw_vars])

                res = process_formula(expression, variables)

                shunting_data = [
                    {
                        "step_num": s.step_num,
                        "token_raw": s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg",
                        "action": s.action,
                        "operator_stack": s.operator_stack,
                        "output_queue": s.output_queue,
                    }
                    for s in res.shunting_trace
                ]

                eval_data = [
                    {
                        "step_num": s.step_num,
                        "token_raw": s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg",
                        "operation_desc": s.operation_desc,
                        "subexpression_evaluated": s.subexpression_evaluated,
                        "result_value": s.result_value,
                        "stack_state": s.stack_state,
                    }
                    for s in res.eval_trace
                ]

                response_obj = {
                    "success": True,
                    "expression": res.expression,
                    "formatted_result": res.formatted_result,
                    "result_numeric": res.result,
                    "postfix_str": res.postfix_str,
                    "tree_text": res.tree_text,
                    "shunting_trace": shunting_data,
                    "eval_trace": eval_data,
                }
            except ObservatoryError as err:
                response_obj = {
                    "success": False,
                    "error_message": err.message,
                    "diagnostic": err.format_diagnostic(),
                }
            except Exception as e:
                response_obj = {
                    "success": False,
                    "error_message": str(e),
                    "diagnostic": f"Server Error: {str(e)}",
                }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_obj).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()


def run_web_server(port: int = 8080) -> None:
    server_address = ("", port)
    httpd = HTTPServer(server_address, ObservatoryHttpHandler)
    print(f"🔭 Observatory Web Interface running at http://localhost:{port}/")
    print("Press Ctrl+C to stop the server.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Observatory Web Server.")
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_web_server(port)
