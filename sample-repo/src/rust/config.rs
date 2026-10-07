use std::env;

pub fn load_database_configuration() -> Result<String, env::VarError> {
    // Level 3 Rust environment access
    let db = env::var("DATABASE_URL")?;
    Ok(db)
}
