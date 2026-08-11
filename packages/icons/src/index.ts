import { createElement } from "react"
import { Bold, type LucideIcon, type LucideProps } from "lucide-react"

export type Icon = LucideIcon
export type IconProps = LucideProps

export const BoldIcon = ((props: IconProps) =>
  createElement(Bold, props)) as Icon

export {
  ArrowUpRight as ArrowUpRightIcon,
  Check as CheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronsUpDown as ChevronsUpDownIcon,
  CloudCheck as CloudCheckIcon,
  Code as CodeIcon,
  Ellipsis as EllipsisIcon,
  FileText as FileTextIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  GripVertical as GripVerticalIcon,
  Heading1 as Heading1Icon,
  Heading2 as Heading2Icon,
  Heading3 as Heading3Icon,
  Info as InfoIcon,
  Italic as ItalicIcon,
  Library as LibraryIcon,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  ListTodo as ListTodoIcon,
  MessageSquare as MessageSquareIcon,
  Pilcrow as PilcrowIcon,
  Plus as PlusIcon,
  Quote as QuoteIcon,
  Redo2 as RedoIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Smile as SmileIcon,
  Star as StarIcon,
  Strikethrough as StrikethroughIcon,
  Underline as UnderlineIcon,
  Undo2 as UndoIcon,
  Unlink as UnlinkIcon,
  Users as UsersIcon,
  X as XIcon,
} from "lucide-react"
