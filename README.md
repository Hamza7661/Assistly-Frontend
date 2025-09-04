# Assistly - Virtual Assistant Platform

A modern, professional Next.js application for virtual assistant service providers. Built with TypeScript, Tailwind CSS, and production-grade practices.

## 🚀 Features

- **Authentication System**: Secure sign-in and registration with JWT tokens
- **Package Management**: View and create custom packages with dynamic pricing
- **Dashboard**: Comprehensive analytics and service overview
- **Responsive Design**: Mobile-first approach with professional UI
- **Lazy Loading**: Optimized service loading for better performance
- **Type Safety**: Full TypeScript implementation with class-based models

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **State Management**: React Context API
- **HTTP Client**: Native fetch API

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Main dashboard page
│   ├── packages/          # Package management
│   ├── settings/          # User settings
│   ├── signin/            # Sign-in page
│   └── signup/            # Registration page
├── components/            # Reusable UI components
├── contexts/              # React contexts (Auth)
├── models/                # Class-based data models
├── services/              # API services with lazy loading
└── globals.css            # Global styles and Tailwind
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd assistly-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `.env.local` with your API configuration:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🌐 API Integration

The application integrates with a backend API for:

- **Authentication**: `/auth/signup`, `/auth/signin`
- **Packages**: `/packages`, `/custom-packages`
- **User Management**: User profile and settings

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | User registration |
| `/auth/signin` | POST | User authentication |
| `/packages` | GET | Fetch available packages |
| `/custom-packages` | POST | Create custom package |

## 🎨 Design System

### Color Palette
- **Primary**: White (#ffffff)
- **Secondary**: Green (#00bc7d)
- **Text Primary**: Dark Gray (#1f2937)
- **Text Secondary**: Medium Gray (#6b7280)

### Typography
- **Font Family**: Poppins (Google Fonts)
- **Weights**: 100-900 (including italics)

### Components
- **Buttons**: Primary and secondary variants
- **Cards**: Consistent shadow and border styling
- **Inputs**: Focus states with secondary color
- **Navigation**: Responsive header with user menu

## 🔐 Authentication Flow

1. **Registration**: User fills out form → Package selection → Account creation
2. **Sign In**: Email/password → JWT token → Dashboard access
3. **Protected Routes**: Authentication check → Redirect if unauthorized
4. **Token Management**: Local storage persistence with automatic cleanup

## 📊 Dashboard Features

- **Statistics Cards**: Key metrics with trend indicators
- **Interactive Charts**: Chatbot performance and voice usage
- **Services Overview**: Visual representation of available services
- **Quick Actions**: Navigation shortcuts to key features

## 📦 Package Management

- **Pre-built Packages**: Standard offerings with fixed pricing
- **Custom Packages**: Dynamic creation with real-time pricing
- **Feature Selection**: Checkbox-based feature configuration
- **Limit Configuration**: Slider-based resource allocation

## 🧩 Component Architecture

### Navigation Component
- Responsive header with mobile menu
- User profile dropdown
- Breadcrumb navigation
- Active state management

### Form Components
- Input validation with error handling
- Loading states and success feedback
- Responsive grid layouts
- Accessibility features

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Client and server-side validation
- **Protected Routes**: Authentication guards
- **Secure Storage**: Local storage with token management

## 📱 Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Breakpoints**: Tailwind CSS responsive utilities
- **Touch Friendly**: Mobile-optimized interactions
- **Progressive Enhancement**: Core functionality on all devices

## 🚀 Performance Optimizations

- **Lazy Loading**: Services loaded on-demand
- **Code Splitting**: Automatic route-based splitting
- **Image Optimization**: Next.js built-in optimizations
- **Bundle Analysis**: Webpack bundle analyzer support

## 🧪 Testing

- **ESLint**: Code quality and consistency
- **TypeScript**: Compile-time error checking
- **Component Testing**: Ready for testing framework integration

## 📈 Deployment

### Build for Production
```bash
npm run build
npm run start
```

### Environment Variables
Ensure all required environment variables are set in production:
- `NEXT_PUBLIC_API_URL`: Production API endpoint

### Static Export (Optional)
```bash
npm run export
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

## 🔮 Future Enhancements

- [ ] Real-time notifications
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] API rate limiting
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] PWA capabilities
- [ ] Advanced reporting
- [ ] Integration marketplace
- [ ] White-label solutions
