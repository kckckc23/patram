import { registerConvert } from "./convert.js";
import { registerPdf2Ppt } from "./pdf2ppt.js";

export function registerFromPdf(ENGINES) {
  registerConvert(ENGINES); // pdfWord, pdfXlsx
  registerPdf2Ppt(ENGINES); // pdfPpt
}
