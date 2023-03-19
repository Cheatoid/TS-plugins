import * as ts from "typescript";

interface PluginOptions {
  evaluateMath: boolean;
}

interface CompilerOptionsPlugin {
  transform: string;
}

interface CompilerOptionsPlugins {
  plugins: Partial<CompilerOptionsPlugin>[];
}

function trySimplifyNode(node: ts.Expression, options: PluginOptions): number | false {
  if (ts.isNumericLiteral(node)) {
    return parseFloat(node.text);
  }
  if (ts.isParenthesizedExpression(node)) {
    const { expression } = node;
    if (ts.isNumericLiteral(expression) || // (123)
      ts.isPrefixUnaryExpression(expression)) { // (-123) (~123)
      return trySimplifyNode(expression, options);
    }
  }
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    if (node.operator === ts.SyntaxKind.MinusToken) { // -123
      return -trySimplifyNode(node.operand, options);
    }
    if (node.operator === ts.SyntaxKind.TildeToken) { // ~123
      return ~trySimplifyNode(node.operand, options);
    }
    return trySimplifyNode(node.operand, options); // assume +123
  }
  if (ts.isBinaryExpression(node)) {
    const [lhs, rhs] = [trySimplifyNode(node.left, options), trySimplifyNode(node.right, options)];
    if (lhs !== false && rhs !== false) {
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.BarToken:
          return lhs | rhs;
        case ts.SyntaxKind.CaretToken:
          return lhs ^ rhs;
        case ts.SyntaxKind.AmpersandToken:
          return lhs & rhs;
        case ts.SyntaxKind.LessThanLessThanToken:
          return lhs << rhs;
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
          return lhs >> rhs;
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
          return lhs >>> rhs;
        case ts.SyntaxKind.PlusToken:
          return lhs + rhs;
        case ts.SyntaxKind.MinusToken:
          return lhs - rhs;
        case ts.SyntaxKind.AsteriskToken:
          return lhs * rhs;
        case ts.SyntaxKind.SlashToken:
          return lhs / rhs;
        case ts.SyntaxKind.PercentToken:
          return lhs % rhs;
        case ts.SyntaxKind.AsteriskAsteriskToken:
          return lhs ** rhs;
      }
    }
  }
  if (ts.isCallExpression(node) && options.evaluateMath) {
    const { expression } = node;
    if (ts.isPropertyAccessExpression(expression)) {
      if (
        expression.questionDotToken === undefined &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "Math" &&
        ts.isIdentifier(expression.name)) {
        const callArgs: number[] = [];
        for (const argExpression of node.arguments) {
          const argValue = trySimplifyNode(argExpression, options);
          if (argValue === false) {
            return false;
          }
          callArgs.push(argValue);
        }
        const methodName = expression.getText();
        try {
          const evaluated = eval(`module.exports=${methodName}(${callArgs.join(",")});`);
          if (typeof evaluated === "number") {
            return evaluated;
          }
        } catch {
          return false;
        }
      }
    }
  }
  return false; // Bail out... can't compute it at compile-time
}

function transformer(): ts.TransformerFactory<ts.SourceFile> {
  function transform(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
    const compilerOptions = context.getCompilerOptions() as ts.CompilerOptions & Partial<CompilerOptionsPlugins>;
    const pluginOptions: PluginOptions = {
      evaluateMath: false
    };
    if (compilerOptions.plugins) {
      for (const plugin of compilerOptions.plugins) {
        if (plugin.transform === "@cheatoid/ts-plugins/constant-folding.js") {
          pluginOptions.evaluateMath = (plugin as Partial<PluginOptions>).evaluateMath === true;
          break;
        }
      }
    }
    function makeLiteral(value: number) {
      // Special handling for NaN and negative/positive Infinity
      if (Number.isNaN(value)) {
        return context.factory.createIdentifier("NaN");
        /*return context.factory.createBinaryExpression(
          context.factory.createNumericLiteral(0),
          context.factory.createToken(ts.SyntaxKind.SlashToken),
          context.factory.createNumericLiteral(0)
        );*/
      }
      return Number.isFinite(value)
        ? context.factory.createNumericLiteral(value)
        : (value < 0 ?
          /*context.factory.createBinaryExpression(
            context.factory.createNumericLiteral(-1),
            context.factory.createToken(ts.SyntaxKind.SlashToken),
            context.factory.createNumericLiteral(0)
          )*/context.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          context.factory.createIdentifier("Infinity")
        ) :
          /*context.factory.createBinaryExpression(
            context.factory.createNumericLiteral(1),
            context.factory.createToken(ts.SyntaxKind.SlashToken),
            context.factory.createNumericLiteral(0)
          )*/context.factory.createIdentifier("Infinity"));
    }
    function visit(node: ts.Node): ts.Node {
      node = ts.visitEachChild(node, visit, context); // Bottom-up recursive
      if (ts.isParenthesizedExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isBinaryExpression(node) || (ts.isCallExpression(node) && pluginOptions.evaluateMath)) {
        const value = trySimplifyNode(node, pluginOptions);
        if (value !== false) {
          return makeLiteral(value);
        }
      }
      return node;
    }
    function transformFile(sourceFile: ts.SourceFile): ts.SourceFile {
      return ts.visitEachChild(sourceFile, visit, context);
    }
    return transformFile;
  }
  return transform;
}

export default transformer;
