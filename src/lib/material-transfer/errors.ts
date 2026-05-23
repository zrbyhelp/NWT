export class MaterialTransferError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "MaterialTransferError";
    this.code = code;
  }
}
