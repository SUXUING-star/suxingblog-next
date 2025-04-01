// src/components/PostForm.mantine.tsx
import React, { useState, useEffect } from 'react';
import { IPost } from '../../types/types'; // 确保 IPost 也更新了（或者 excerpt 本就是可选的）
import {
	Box, TextInput, Textarea, Checkbox, Button, Group, Stack,
	MultiSelect,
} from '@mantine/core';
import { useForm } from '@mantine/form';

// 更新 PostFormData，移除 excerpt
// 明确只包含表单中的字段
export type PostFormData = {
	title: string;
	slug: string;
	content: string;
	tags: string[];
	isPublished: boolean;
};

interface PostFormProps {
	initialData?: IPost | null;
	onSubmit: (data: PostFormData) => Promise<void>;
	onCancel?: () => void;
	availableTags?: string[];
}

const PostForm: React.FC<PostFormProps> = ({
	initialData,
	onSubmit,
	onCancel,
	availableTags = ['讨论', '交流', '教程', '分享', '新闻', '公告', '其他'], // 默认标签
}) => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isEditing = !!initialData;

	const form = useForm<PostFormData>({
		initialValues: {
			title: '',
			slug: '',
			content: '',
			tags: [],
			isPublished: false,
		},
		validate: {
			title: (value) => (value && value.trim() ? null : '标题不能为空'),
			slug: (value) => {
				if (!value || !value.trim()) return '标识不能为空';
				if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return '标识格式无效 (只能用小写字母、数字和连字符)';
				return null;
			},
			content: (value) => (value && value.trim() ? null : '内容不能为空'),
		},
	});

	useEffect(() => {
		form.setValues({
			title: initialData?.title || '',
			slug: initialData?.slug || '',
			content: initialData?.content || '',
			tags: initialData?.tags?.filter(tag => availableTags.includes(tag)) || [],
			isPublished: initialData?.isPublished || false,
		});
	}, [initialData]);

	// 自动生成 Slug 的逻辑不变
	useEffect(() => {
		const titleValue = form.values.title;
		if (titleValue && !form.values.slug && !isEditing) {
			const generatedSlug = titleValue
				.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
			form.setFieldValue('slug', generatedSlug);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [form.values.title, isEditing]);

	const handleSubmit = async (values: PostFormData) => {
		setIsSubmitting(true);
		try {
			// 确保只传递 PostFormData 定义的字段
			const dataToSend: PostFormData = {
				title: values.title,
				slug: values.slug,
				content: values.content,
				tags: values.tags,
				isPublished: values.isPublished
			};
			await onSubmit(dataToSend);
			if (!isEditing) {
				form.reset();
			}
		} catch (error) {
			console.error("Form submission error:", error);
			// 错误处理应在 HomePage 中通过 setError 显示
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Box component="form" onSubmit={form.onSubmit(handleSubmit)} p="lg" /* bg="gray.0" */ > {/* 可以去掉背景色让它更融入 Modal */}
			<Stack gap="md">
				<TextInput label="标题" required {...form.getInputProps('title')} disabled={isSubmitting} placeholder="给你的帖子起个名字" />
				<TextInput label="标识 (Slug)" required description="用于生成访问链接 (小写字母、数字、连字符)" {...form.getInputProps('slug')} disabled={isSubmitting} placeholder="例如: my-first-post" />
				<Textarea
					label="内容"
					required
					autosize // 自动调整高度
					minRows={10} // <-- 增加最小行数，更沉浸
					maxRows={25} // <-- （可选）限制最大行数
					placeholder="在这里尽情书写你的想法..."
					{...form.getInputProps('content')}
					disabled={isSubmitting}
				/>

				<MultiSelect
					label="标签"
					placeholder="选择或搜索标签"
					data={availableTags}
					searchable
					clearable
					nothingFoundMessage="没找到匹配的标签"
					{...form.getInputProps('tags')}
					disabled={isSubmitting}
				/>

				<Checkbox
					label="发布这篇帖子?"
					{...form.getInputProps('isPublished', { type: 'checkbox' })}
					disabled={isSubmitting}
				/>
				<Group justify="flex-end" mt="md">
					{/* 如果提供了 onCancel 回调，则显示取消按钮 */}
					{onCancel && (
						<Button variant="default" onClick={onCancel} disabled={isSubmitting}>
							取消
						</Button>
					)}
					<Button type="submit" loading={isSubmitting} loaderProps={{ type: 'dots' }}>
						{isEditing ? '更新帖子' : '创建帖子'}
					</Button>
				</Group>
			</Stack>
		</Box>
	);
};

export default PostForm;