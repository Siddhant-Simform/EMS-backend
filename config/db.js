const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;
const isPlaceholder = !process.env.DB_HOST || 
                      process.env.DB_HOST.includes('your-azure-db-host') || 
                      process.env.DB_USER === 'your_db_user';

if (isPlaceholder) {
  console.log('⚠️  Using default/sample database environment variables.');
  console.log('👉 Connecting to local SQLite database (database.sqlite) as a fallback.');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false
  });
} else {
  const useSSL = process.env.DB_SSL === 'true' || 
                 (process.env.DB_HOST && process.env.DB_HOST.includes('azure.com'));

  console.log(`🔌 Attempting connection to PostgreSQL at ${process.env.DB_HOST}...`);
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      dialectOptions: useSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false // Necessary for Azure PostgreSQL
        }
      } : {},
      logging: false
    }
  );
}

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    if (isPlaceholder) {
      console.log('✅ SQLite fallback database connected successfully.');
    } else {
      console.log('✅ Connected successfully to Azure Managed PostgreSQL database.');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    if (!isPlaceholder) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }
};

module.exports = {
  sequelize,
  testConnection
  
};
