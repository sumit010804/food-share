# FoodShare - Smart Surplus Food Redistribution Platform

A comprehensive zero-waste campus management system that connects food providers with recipients to reduce food waste and promote sustainability.

## Features

### 🍽️ Core Functionality
- **Surplus Food Listing Platform**: Create and browse food listings with detailed information
- **Real-Time Notifications**: Get alerts for new listings, pickup reminders, and expiry warnings
- **Food Safety & Quality Tagging**: Track freshness, allergens, and safety information
- **Analytics Dashboard**: Monitor environmental impact and usage statistics
- **Event Integration**: Connect campus events with food redistribution workflows

### 👥 User Types
- **Students**: Browse and reserve available food
- **Staff**: List surplus food and coordinate pickups
- **Canteen Managers**: Manage daily surplus food from dining facilities
- **Hostel Managers**: Handle food from hostel kitchens and events
- **Event Organizers**: Log post-event surplus food
- **NGO Representatives**: Coordinate large-scale food redistribution

### 🔐 Authentication & Security
- Secure user registration and login
- Role-based access control
- JWT-based authentication
- Password hashing with bcrypt 

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT, bcrypt
- **UI Components**: shadcn/ui, Radix UI
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd foodshare-platform
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Update the `.env.local` file with your MongoDB connection string and other configuration:
   \`\`\`env
   MONGODB_URI=mongodb://localhost:27017/foodshare
   JWT_SECRET=your-super-secret-jwt-key-here
   \`\`\`

4. **Set up the database**
   \`\`\`bash
   npm run setup-db
   \`\`\`

5. **Run the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Database Setup

The platform uses MongoDB with the following collections:
- `users` - User accounts and preferences
- `foodListings` - Surplus food listings
- `notifications` - User notifications
- `events` - Campus events
- `analytics` - Usage and impact metrics

Run the setup script to create collections with proper validation and indexes:
\`\`\`bash
node scripts/setup-mongodb.js
\`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login

### Food Listings
- `GET /api/food-listings` - Get all food listings
- `POST /api/food-listings` - Create new food listing
- `PUT /api/food-listings/[id]` - Update food listing
- `DELETE /api/food-listings/[id]` - Delete food listing

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/[id]/read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all notifications as read

### Events
- `GET /api/events` - Get events
- `POST /api/events` - Create new event
- `POST /api/events/[id]/food-logged` - Mark event food as logged

### Analytics
- `GET /api/analytics` - Get analytics data

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NEXTAUTH_URL` | Application URL | No |
| `SMTP_HOST` | Email server host | No |
| `SMTP_USER` | Email username | No |
| `SMTP_PASS` | Email password | No |

Optional tuning:

- `KG_PER_PERSON` (server): kilograms of food required to feed one person (default `0.5`).
- `NEXT_PUBLIC_KG_PER_PERSON` (client): same as above for UI derivations (default `0.5`).

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ for a sustainable future**
