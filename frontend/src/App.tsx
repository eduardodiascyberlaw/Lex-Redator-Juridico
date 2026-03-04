import { Routes, Route, Navigate } from "react-router-dom";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-500">Em desenvolvimento...</p>
    </div>
  </div>
);

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="LexBuild" className="h-20 w-auto" />
            </a>
            <span className="text-sm text-gray-500">v1.0.0</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<PlaceholderPage title="Novo Caso" />} />
          <Route path="/cases" element={<PlaceholderPage title="Lista de Casos" />} />
          <Route path="/cases/:id" element={<PlaceholderPage title="Dashboard do Caso" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-gray-500 text-center">
            LexBuild &mdash; Sistema de Agentes de IA para Pe&ccedil;as Processuais
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
