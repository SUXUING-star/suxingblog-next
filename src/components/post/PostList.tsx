// src/components/PostList.mantine.tsx
import React from 'react';
import { IPost } from '../../types/types';
import { Stack, Text, Paper } from '@mantine/core'; // Paper 用于卡片效果
import PostItem from './PostItem'; // 稍后创建 Mantine 版本的 Item

interface PostListProps {
  posts: IPost[];
  onEdit: (post: IPost) => void;
  onDelete: (id: string) => void;
  // isLoading: boolean; // 可以移除，由 HomePage 控制整体加载
  editingPostId: string | null;
}

const PostList: React.FC<PostListProps> = ({ posts, onEdit, onDelete, editingPostId }) => {

  if (posts.length === 0) {
    return (
        <Paper withBorder p="xl" radius="md" ta="center">
            <Text size="lg" c="dimmed">
                现在没有任何帖子，赶紧创建吧
            </Text>
        </Paper>
    );
  }

  return (
    <Stack gap="lg">
      {/* <Title order={2} ta="center" mb="lg">Posts</Title> */} {/* HomePage 已有标题 */}
      {posts.map((post) => (
        <PostItem
          key={post._id}
          post={post}
          onEdit={onEdit}
          onDelete={onDelete}
          //isLoading={isLoading} // 可以不传，按钮的 loading 由全局控制
          isEditingOther={!!editingPostId && editingPostId !== post._id}
        />
      ))}
    </Stack>
  );
};

export default PostList;