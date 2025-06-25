import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await login(email, password);
      navigate('/'); 
    } catch (err: any) {
      setError('Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Şifre sıfırlama için lütfen e-posta alanını doldurun.");
      return;
    }
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await resetPassword(email);
      setMessage("Şifre sıfırlama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.");
    } catch (err: any) {
      setError('Şifre sıfırlama e-postası gönderilemedi.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="mx-auto h-12 w-12 bg-primary-600 rounded-xl flex items-center justify-center"
          >
            <GraduationCap className="h-8 w-8 text-white" />
          </motion.div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Hesabınıza giriş yapın
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Veya{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              yeni hesap oluşturun
            </Link>
          </p>
        </div>

        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl"
          onSubmit={handleSubmit}
        >
          {error && <p className="bg-red-500 text-white p-3 rounded mb-4 text-center">{error}</p>}
          {message && <p className="bg-green-500 text-white p-3 rounded mb-4 text-center">{message}</p>}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                E-posta adresi
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="ornek@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Şifre
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="Şifrenizi girin"
                required
              />
            </div>
          </div>

          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Giriş Yap'
              )}
            </motion.button>
          </div>
        </motion.form>

        <div className="text-center mt-4">
          <button onClick={handlePasswordReset} disabled={loading} className="text-sm text-blue-500 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">
            Şifremi Unuttum
          </button>
        </div>

        <p className="text-center mt-4 text-gray-600 dark:text-gray-400">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-blue-500 hover:underline">
            Kayıt Ol
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginForm;