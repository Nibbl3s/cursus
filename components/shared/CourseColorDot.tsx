interface CourseColorDotProps {
  color: string;
  size?: number;
}

export function CourseColorDot({ color, size = 10 }: CourseColorDotProps) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}
