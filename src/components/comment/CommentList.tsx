// src/components/CommentList.mantine.tsx
import React from 'react';
import { SimpleComment } from '../../types/types'; // 确保类型路径正确
import { Stack, Box, Text, Group, Avatar, Paper, ThemeIcon, Loader, Center } from '@mantine/core';
import { IconMessageCircle, IconUserCircle } from '@tabler/icons-react';

interface CommentListProps {
  comments: SimpleComment[];
  isLoading: boolean;
  error?: string | null;
}

const CommentList: React.FC<CommentListProps> = ({ comments, isLoading, error }) => {

  if (isLoading) {
    return (
        <Center my="lg">
            <Loader color="gray" size="sm" />
            <Text ml="sm" size="sm" c="dimmed">正在加载 ...</Text>
        </Center>
    );
  }

   if (error) {
    return (
        <Text c="red" size="sm" ta="center" my="lg">
            Error loading comments: {error}
        </Text>
    );
  }

  if (comments.length === 0) {
    return (
        <Center my="lg">
            <Text size="sm" c="dimmed">还没有评论，快来占沙发</Text>
         </Center>
    );
  }

  return (
    <Stack gap="lg" mt="xl">
      {comments.map((comment) => (
        <Paper key={comment._id} p="md" withBorder radius="md">
          <Group align="flex-start">
             {/* 头像占位符 */}
             <ThemeIcon size="lg" radius="xl" variant="light">
                 <IconUserCircle size={20}/>
            </ThemeIcon>
            {/* <Avatar radius="xl">{comment.authorName.charAt(0).toUpperCase()}</Avatar> */}
            <Box style={{ flex: 1 }}>
              <Group justify="space-between" align="center" mb={2}>
                <Text fw={500} size="sm">{comment.authorName}</Text>
                <Text size="xs" c="dimmed">{new Date(comment.createdAt).toLocaleString()}</Text>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}> {/* 保留换行 */}
                  {comment.content}
              </Text>
            </Box>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
};

export default CommentList;