// src/types.ts
export interface IPost {
  _id: string; // MongoDB ID
  title: string;
  slug: string;
  content: string;
  authorId: string;
  tags?: string[];
  excerpt?: string;
  isPublished: boolean;
  publishedAt?: string; // 日期通常作为 ISO 字符串传输
  createdAt: string;   // 日期通常作为 ISO 字符串传输
  updatedAt: string;   // 日期通常作为 ISO 字符串传输
}

// 可选：如果需要明确分页信息类型
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalPosts: number;
}

// 登录表单数据
export interface LoginCredentials {
	email: string;
	password: string;
}

// 注册表单数据 (可以根据需要添加字段)
export interface RegisterCredentials extends LoginCredentials {
	name?: string; // 可选
}

// 用户数据结构 (与后端登录返回一致)
export interface UserData {
	id: string;
	email: string;
	name?: string;
}
export interface SimpleComment {
	_id: string;
	authorName: string;
	content: string;
	createdAt: string; // ISO Date String
}