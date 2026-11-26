"""
Formatters for rendering formula processing results in terminal and plain-text.
Supports Rich console tables and trees when rich is installed, with clean text fallback.
"""

from typing import Optional, Any
from observatory.processor import FormulaResult

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.tree import Tree as RichTree
    from rich.text import Text
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False


def print_plain_text_result(res: FormulaResult) -> str:
    """Produces a detailed, clean plain-text report of the formula processing."""
    out = []
    bar = "=" * 76
    sub_bar = "-" * 76

    out.append(bar)
    out.append("  OBSERVATORY FORMULA EVALUATION REPORT")
    out.append(bar)
    out.append(f"Expression:  {res.expression}")
    if res.variables:
        var_str = ", ".join(f"{k} = {v}" for k, v in sorted(res.variables.items()))
        out.append(f"Variables:   {var_str}")
    else:
        out.append("Variables:   (None)")
    out.append(f"Final Result: [ {res.formatted_result} ]")
    out.append("")

    # 1. Shunting-Yard Trace
    out.append(sub_bar)
    out.append("1. INFIX-TO-POSTFIX (SHUNTING-YARD) PARSING TRACE")
    out.append(sub_bar)
    header = f"{'Step':<5} | {'Token':<8} | {'Action':<35} | {'Op Stack':<12} | {'Output Queue'}"
    out.append(header)
    out.append("-" * len(header))
    for s in res.shunting_trace:
        op_stk = " ".join(s.operator_stack) if s.operator_stack else "(empty)"
        out_q = " ".join(s.output_queue) if s.output_queue else "(empty)"
        tok_str = s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg"
        out.append(f"{s.step_num:<5} | {tok_str:<8} | {s.action[:35]:<35} | {op_stk:<12} | {out_q}")
    out.append("")
    out.append(f"Postfix (RPN): {res.postfix_str}")
    out.append("")

    # 2. Expression Tree
    out.append(sub_bar)
    out.append("2. READABLE EXPRESSION TREE REPRESENTATION")
    out.append(sub_bar)
    out.append(res.tree_text)
    out.append("")

    # 3. Intermediate Calculations Trace
    out.append(sub_bar)
    out.append("3. STEP-BY-STEP INTERMEDIATE CALCULATIONS TRACE")
    out.append(sub_bar)
    calc_header = f"{'Step':<5} | {'Token':<8} | {'Subexpression / Operation':<32} | {'Result':<10} | {'Stack State'}"
    out.append(calc_header)
    out.append("-" * len(calc_header))
    for s in res.eval_trace:
        tok_str = s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg"
        stack_str = ", ".join(s.stack_state) if s.stack_state else "(empty)"
        out.append(f"{s.step_num:<5} | {tok_str:<8} | {s.subexpression_evaluated[:32]:<32} | {str(s.result_value):<10} | {stack_str}")
    out.append("")
    out.append(bar)
    out.append(f"VERIFIED ACCURATE RESULT: {res.formatted_result}")
    out.append(bar)

    return "\n".join(out)


def display_rich_result(res: FormulaResult, console: Optional[Any] = None) -> None:
    """Displays the result using Rich tables, panels, and trees."""
    if not RICH_AVAILABLE:
        print(print_plain_text_result(res))
        return

    if console is None:
        console = Console()

    # Overview Panel
    var_str = ", ".join(f"[bold cyan]{k}[/] = [yellow]{v}[/]" for k, v in sorted(res.variables.items())) if res.variables else "[dim](None)[/]"
    overview_text = (
        f"[bold]Expression:[/]   [bright_white]{res.expression}[/]\n"
        f"[bold]Variables:[/]    {var_str}\n"
        f"[bold]Postfix (RPN):[/] [magenta]{res.postfix_str}[/]\n"
        f"[bold green]Final Result:[/]  [bold green underline]{res.formatted_result}[/]"
    )
    console.print(Panel(overview_text, title="🔭 [bold cyan]Observatory Formula Evaluation[/]", expand=False))

    # 1. Shunting Yard Table
    sy_table = Table(title="[bold yellow]Infix-to-Postfix (Shunting-Yard) Trace[/]", show_header=True, header_style="bold blue")
    sy_table.add_column("Step", style="dim", width=5)
    sy_table.add_column("Token", style="bold magenta", width=8)
    sy_table.add_column("Action Taken", width=40)
    sy_table.add_column("Operator Stack", style="cyan", width=16)
    sy_table.add_column("Output Queue", style="green")

    for s in res.shunting_trace:
        tok_str = s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg"
        op_stk = " ".join(s.operator_stack) if s.operator_stack else "[dim]empty[/]"
        out_q = " ".join(s.output_queue) if s.output_queue else "[dim]empty[/]"
        sy_table.add_row(str(s.step_num), tok_str, s.action, op_stk, out_q)

    console.print(sy_table)

    # 2. Expression Tree
    console.print(Panel(f"[bold green]Expression Tree Structure[/]\n\n{res.tree_text}", title="🌳 [bold green]Expression Tree[/]", expand=False))

    # 3. Intermediate Calculations Table
    eval_table = Table(title="[bold green]Intermediate Calculations & Stack Trace[/]", show_header=True, header_style="bold blue")
    eval_table.add_column("Step", style="dim", width=5)
    eval_table.add_column("Token", style="bold magenta", width=8)
    eval_table.add_column("Subexpression / Operation", width=34)
    eval_table.add_column("Result", style="bold yellow", width=12)
    eval_table.add_column("Value Stack State", style="cyan")

    for s in res.eval_trace:
        tok_str = s.token.raw if s.token.type.name != "UNARY_MINUS" else "neg"
        stack_str = ", ".join(s.stack_state) if s.stack_state else "[dim]empty[/]"
        eval_table.add_row(str(s.step_num), tok_str, s.subexpression_evaluated, str(s.result_value), stack_str)

    console.print(eval_table)

    # Final summary banner
    console.print(Panel(
        f"[bold bright_green]Calculation Complete:[/] [white]{res.expression}[/] = [bold bright_yellow]{res.formatted_result}[/]",
        style="bold green",
        expand=False,
    ))
