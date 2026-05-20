import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export function createNovelTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 160,
    separators: ["\n\n", "\n", "。", "！", "？", ".", " ", ""]
  });
}

