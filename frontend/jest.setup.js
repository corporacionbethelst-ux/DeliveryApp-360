/**
 * Delivery360 - Jest Setup File
 */
import '@testing-library/jest-dom';

// Mock para next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: '',
      asPath: '',
      push: jest.fn(),
      replace: jest.fn(),
    };
  },
}));

// Mock para next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function Image(props) {
    return <img {...props} />;
  },
}));

// Mock para variables de entorno
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'test-token';
