// src/components/PostForm.mantine.tsx
import React, { useState, useEffect} from 'react';
import { IPost } from '../../types/types';
import {
  Box, TextInput, Textarea, Checkbox, Button, Group, Stack, 
  MultiSelect, // 仍然使用 MultiSelect 来选择已有标签
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';

export type PostFormData = Partial<Omit<IPost, '_id' | 'createdAt' | 'updatedAt'>>;

interface PostFormProps {
  initialData?: IPost | null;
  onSubmit: (data: PostFormData) => Promise<void>;
  onCancel?: () => void;
  // 模拟的可用标签列表 (实际应用中可能来自 API)
  availableTags?: string[];
}

const PostForm: React.FC<PostFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  availableTags = ['react', 'typescript', 'mantine', 'blog', 'nextjs'] // 提供示例已有标签
}) => {
  const theme = useMantineTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!initialData;

  const form = useForm<PostFormData>({
		initialValues: {
      title: '',
      slug: '',
      content: '',
      tags: [],
      excerpt: '',
      isPublished: false,
    },
    // 添加验证规则
    validate: {
      title: (value) => (value && value.trim() ? null : 'Title is required'),
      slug: (value) => {
        if (!value || !value.trim()) return 'Slug is required';
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return 'Invalid slug format (use lowercase, numbers, hyphens)';
        return null;
      },
      content: (value) => (value && value.trim() ? null : 'Content is required'),
      // tags, excerpt, isPublished 通常不需要验证
    },
  });

  useEffect(() => {
    form.setValues({
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      content: initialData?.content || '',
      // 确保 initialData 里的 tags 能被 MultiSelect 选中 (值必须在 availableTags 里)
      tags: initialData?.tags?.filter(tag => availableTags.includes(tag)) || [],
      excerpt: initialData?.excerpt || '',
      isPublished: initialData?.isPublished || false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]); // availableTags 变化通常不重置表单已选，除非你有特定逻辑
// 自动生成 Slug 的逻辑 (当 title 改变且 slug 为空时)
useEffect(() => {
	const titleValue = form.values.title;
	if (titleValue && !form.values.slug && !isEditing) { // 只在创建且 slug 为空时自动生成
		const generatedSlug = titleValue
			.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
		form.setFieldValue('slug', generatedSlug);
	}
	// eslint-disable-next-line react-hooks/exhaustive-deps
}, [form.values.title, isEditing]); // 依赖 title 和编辑状态

  const handleSubmit = async (values: PostFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
       if (!isEditing) {
           form.reset();
       }
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)} p="lg" bg="gray.0" style={{ borderRadius: theme.radius.md, border: `1px solid ${theme.colors.gray[3]}` }}>
      <Stack gap="md">
        {/* ... Title, Slug, Content, Excerpt ... */}
         <TextInput label="标题" required {...form.getInputProps('title')} disabled={isSubmitting}/>
        <TextInput label="标识" required description="..." {...form.getInputProps('slug')} disabled={isSubmitting}/>
        <Textarea label="内容" required autosize minRows={4} {...form.getInputProps('content')} disabled={isSubmitting}/>
        <Textarea label="概要" autosize minRows={2} maxLength={300} {...form.getInputProps('excerpt')} disabled={isSubmitting}/>


        {/* MultiSelect - 仅用于选择已有标签 */}
        <MultiSelect
            label="标签"
            placeholder="选择合适的标签"
            data={availableTags} // <--- 数据源是预定义的可用标签
            searchable // 允许搜索
            clearable
            nothingFoundMessage="No matching tags found" // 没有匹配项时的消息
            // 移除 onCreate 和 getCreateLabel
            {...form.getInputProps('tags')}
            disabled={isSubmitting}
        />

        {/* ... Checkbox, Buttons ... */}
         <Checkbox
          label="要发布吗?"
          {...form.getInputProps('isPublished', { type: 'checkbox' })}
          disabled={isSubmitting}
        />
         <Group justify="flex-end" mt="md">
          {isEditing && onCancel && (
            <Button variant="default" onClick={onCancel} disabled={isSubmitting}>
              取消编辑
            </Button>
          )}
          <Button type="submit" loading={isSubmitting} loaderProps={{ type: 'dots' }}>
            {isEditing ? 'Update Post' : 'Create Post'}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
};

export default PostForm;