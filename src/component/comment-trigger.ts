export type CommentTrigger = "hover-or-caret" | "caret";

export const defaultCommentTrigger: CommentTrigger = "hover-or-caret";

export function allowsCommentHover(trigger: CommentTrigger) {
  return trigger === "hover-or-caret";
}
