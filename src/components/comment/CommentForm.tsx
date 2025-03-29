// src/components/CommentForm.mantine.tsx
import React, { useState } from 'react';
import { useForm } from '@mantine/form';
import { Box , Textarea, Button, Group, Stack, Alert } from '@mantine/core';
import { IconSend, IconAlertCircle } from '@tabler/icons-react';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>; // 接收内容并返回 Promise
  isSubmitting: boolean; // 外部控制提交状态
}

const CommentForm: React.FC<CommentFormProps> = ({ onSubmit, isSubmitting }) => {
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      content: '',
    },
    validate: {
      content: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return 'Comment cannot be empty.';
          if (trimmed.length > 1000) return 'Comment cannot exceed 1000 characters.';
          return null;
      },
    },
  });

  const handleSubmit = async (values: { content: string }) => {
    setError(null); // 清除旧错误
    try {
        await onSubmit(values.content); // 调用外部提交函数
        form.reset(); // 成功后清空表单
    } catch (err: any) {
        const message = err instanceof Error ? err.message : 'Failed to submit comment.';
        setError(message); // 显示错误
    }
  };

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)} mt="xl">
      <Stack gap="sm">
        {error && (
             <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" radius="sm" withCloseButton onClose={() => setError(null)}>
                {error}
            </Alert>
        )}
        <Textarea
          placeholder="写下你想说的话..."
          label="添加评论"
          required
          autosize
          minRows={3}
          {...form.getInputProps('content')}
          disabled={isSubmitting} // 提交时禁用
        />
        <Group justify="flex-end">
          <Button
            type="submit"
            leftSection={<IconSend size={16} />}
            loading={isSubmitting} // 使用外部传入的 loading 状态
            loaderProps={{ type: 'dots' }}
          >
            发布评论
          </Button>
        </Group>
      </Stack>
    </Box>
  );
};

export default CommentForm;