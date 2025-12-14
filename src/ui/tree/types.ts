export type ZennNodeType =
  | "articles"
  | "books"
  | "drafts"
  | "images"
  | "chapter"
  | "book"
  | "article"
  | "image"
  | "action";

export type SortOrder = "date" | "title";

export interface BranchInfo {
  workBranch: string;
  mainBranch: string;
}
