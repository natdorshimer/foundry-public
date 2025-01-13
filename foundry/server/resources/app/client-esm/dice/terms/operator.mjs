import RollTerm from "./term.mjs";

/**
 * A type of RollTerm used to denote and perform an arithmetic operation.
 * @extends {RollTerm}
 */
export default class OperatorTerm extends RollTerm {
  constructor({operator, options}={}) {
    super({options});
    this.operator = operator;
  }

  /**
   * The term's operator value.
   * @type {string}
   */
  operator;

  /**
   * An object of operators with their precedence values.
   * @type {Readonly<Record<string, number>>}
   */
  static PRECEDENCE = Object.freeze({
    "+": 10,
    "-": 10,
    "*": 20,
    "/": 20,
    "%": 20
  });

  /**
   * An array of operators which represent arithmetic operations
   * @type {string[]}
   */
  static OPERATORS = Object.keys(this.PRECEDENCE);

  /** @inheritdoc */
  static REGEXP = new RegExp(this.OPERATORS.map(o => "\\"+o).join("|"), "g");

  /** @inheritdoc */
  static SERIALIZE_ATTRIBUTES = ["operator"];

  /** @inheritdoc */
  get flavor() {
    return ""; // Operator terms cannot have flavor text
  }

  /** @inheritdoc */
  get expression() {
    return ` ${this.operator} `;
  }

  /** @inheritdoc */
  get total() {
    return ` ${this.operator} `;
  }
}

