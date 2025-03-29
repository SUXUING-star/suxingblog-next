// src/components/Pagination.mantine.tsx
import React from 'react';
import { Pagination as MantinePagination, Center } from '@mantine/core';

interface PaginationProps {
  total: number; // Mantine 需要总页数
  value: number; // 当前页 (从 1 开始)
  onChange: (page: number) => void;
  disabled?: boolean;
  position?: 'left' | 'center' | 'right'; // 控制对齐
}

const PostPagination: React.FC<PaginationProps> = ({ total, value, onChange, disabled }) => {
  if (total <= 1) {
    return null; // 只有一页或没有页不显示
  }

  return (
     <Center mt="xl"> {/* 使用 Center 居中 */}
      <MantinePagination
        total={total}
        value={value}
        onChange={onChange}
        disabled={disabled}
        color="blue" // 设置颜色
        // withEdges // 显示第一页/最后一页按钮
        // boundaries={1} // 控制当前页旁边显示多少页码
      />
     </Center>
  );
};

export default PostPagination;