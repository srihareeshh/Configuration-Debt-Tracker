using System;

namespace EnterpriseApp
{
    public class Settings
    {
        public static string GetDatabaseConnection()
        {
            // Level 3 C# environment access
            var db = Environment.GetEnvironmentVariable("DATABASE_URL");
            return db ?? "default_connection";
        }
    }
}
