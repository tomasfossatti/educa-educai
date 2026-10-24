export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  workflow_state?: string;
  account_id?: number;
  start_at?: string | null;
  end_at?: string | null;
  term?: {
    id: number;
    name: string;
    start_at?: string | null;
    end_at?: string | null;
  };
  enrollments?: Array<{
    type: string;
    role: string;
    enrollment_state?: string;
  }>;
  total_students?: number;
  calendar?: {
    ics?: string;
  };
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  points_possible?: number;
  course_id: number;
  html_url?: string;
  submission_types?: string[];
  has_submitted_submissions?: boolean;
}

export interface CanvasTodoItem {
  type: string; // "submitting" | "grading"
  assignment?: CanvasAssignment;
  quiz?: {
    id: number;
    title: string;
    due_at?: string | null;
    points_possible?: number;
    html_url?: string;
  };
  context_name?: string;
  course_id?: number;
  html_url?: string;
  ignore?: string;
  ignore_permanently?: string;
}

export interface CanvasFile {
  id: number;
  uuid?: string;
  folder_id?: number;
  display_name: string;
  filename: string;
  'content-type'?: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  unlock_at?: string | null;
  locked?: boolean;
  hidden?: boolean;
  origin?: 'api_files' | 'modules_fallback' | 'pages_fallback' | 'assignments_fallback' | 'meca';
  origin_context?: string;
}

export interface CanvasModuleItem {
  id: number;
  title: string;
  type: 'File' | 'Page' | 'Assignment' | 'Discussion' | 'Quiz' | 'ExternalUrl' | 'ExternalTool' | string;
  content_id?: number;
  html_url?: string;
  url?: string;
  external_url?: string;
  page_url?: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position?: number;
  unlock_at?: string | null;
  require_sequential_progress?: boolean;
  publish_final_grade?: boolean;
  prerequisite_module_ids?: number[];
  state?: string;
  completed_at?: string | null;
  items_count?: number;
  items_url?: string;
  items?: CanvasModuleItem[];
}

export interface CanvasPage {
  url: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  body?: string;
  front_page?: boolean;
  published?: boolean;
}

export interface CanvasUserProfile {
  id: number;
  name: string;
  short_name?: string;
  sortable_name?: string;
  primary_email?: string;
  login_id?: string;
  avatar_url?: string;
  session_source?: 'environment' | 'secure_store';
}

export interface FileContentResult {
  file: CanvasFile;
  text: string;
  isPdf: boolean;
  numPages?: number;
  charCount: number;
  truncated: boolean;
  sourceType?: 'canvas_file' | 'meca_pdf' | 'meca_text' | 'external_url';
}

export interface CanvasQuiz {
  id: number;
  title: string;
  description?: string;
  quiz_type?: string;
  due_at?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
  time_limit?: number | null;
  allowed_attempts?: number;
  points_possible?: number;
  html_url?: string;
  question_count?: number;
}

export interface CanvasCalendarEvent {
  id: number | string;
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  workflow_state?: string;
  all_day?: boolean;
  all_day_date?: string | null;
  description?: string;
  context_code?: string;
  context_name?: string;
  html_url?: string;
  type?: 'event' | 'assignment';
  assignment?: CanvasAssignment;
}

export interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message?: string;
  html_url?: string;
  posted_at?: string | null;
  last_reply_at?: string | null;
  unread_count?: number;
  read_state?: 'read' | 'unread';
  user_name?: string;
  author?: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
  };
  attachments?: Array<{
    id: number;
    display_name: string;
    url: string;
    size: number;
    'content-type'?: string;
  }>;
}

export interface CanvasDiscussionReply {
  id: number;
  user_id: number;
  parent_id?: number | null;
  created_at: string;
  updated_at?: string;
  message: string;
  user_name?: string;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  course_id?: number;
  attempt?: number;
  body?: string;
  grade?: string | number | null;
  score?: number | null;
  submitted_at?: string | null;
  url?: string;
  submission_type?: 'online_upload' | 'online_text_entry' | 'online_url' | string;
  workflow_state?: 'submitted' | 'unsubmitted' | 'graded' | 'pending_review' | string;
  attachments?: CanvasFile[];
  preview_url?: string;
  html_url?: string;
}

