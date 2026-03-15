import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto px-6 py-12 bg-white rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Access denied</h1>
        <p className="text-sm text-gray-500 mb-6">
          You don't have permission to view this page.
        </p>
        <Link
          href="/"
          className="inline-block py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
