import Link from 'next/link';

interface Course {
  id: string;
  code: string;
  color: string;
}

interface CourseFilterBarProps {
  courses: Course[];
  selectedCourseId: string | null;
  baseHref: string; // e.g. "/student/quests"
}

export function CourseFilterBar({ courses, selectedCourseId, baseHref }: CourseFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* "All" pill */}
      <Link
        href={baseHref}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
          selectedCourseId === null
            ? 'bg-white text-black'
            : 'bg-white/10 text-white/70 hover:bg-white/20'
        }`}
      >
        All
      </Link>

      {/* One pill per enrolled course */}
      {courses.map((course) => {
        const isActive = selectedCourseId === course.id;
        return (
          <Link
            key={course.id}
            href={`${baseHref}?course=${course.id}`}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-opacity"
            style={
              isActive
                ? { backgroundColor: course.color, color: '#fff' }
                : { backgroundColor: course.color + '33', color: course.color }
            }
          >
            {course.code}
          </Link>
        );
      })}
    </div>
  );
}
