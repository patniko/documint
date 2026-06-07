import type {} from "./env";

export {
  Documint,
  defaultKeybindings,
  darkTheme,
  lightTheme,
  type CommentChange,
  type CommentTrigger,
  type DocumintAction,
  type DocumintActions,
  type DocumintDecoration,
  type DocumintLeafPlacement,
  type EditorInputKeybinding,
  type DocumintProps,
  type DocumintSideColumnOptions,
  type DocumintTheme,
  type ResourceProtocolRecord,
  type ActiveResourceSet,
  type UserMentionEvent,
  lucideResourceIcon,
} from "./component";

export type {
  DocumentResourceIcon,
  DocumentResourceIconNode,
  DocumentResourceVectorIcon,
  DocumentPresence,
  DocumentResourceProtocol,
  DocumentResourceReference,
  DocumentUser,
  DocumintStorage,
  EditorInputCommand,
  EditorTheme,
} from "./types";

export { normalizeResourceProtocol, resolveResourceProtocol } from "./document";

export type {
  Anchor,
  Block,
  DirectiveBlock,
  Document,
  Image,
  Inline,
  Link,
  Mark,
  Raw,
  RawBlock,
  Resource,
  Text,
} from "./document";

export type { CommentThread, Comment } from "./document";
