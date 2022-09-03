export const dbConfig: DatabaseConfig = {
    username: "exanubes_database_user",
    password: String(process.env.DB_PASSWORD),
    database: "exanubes_database",
    hostname: "",
    port: 0,
    socketAddress: "",
};

export interface DatabaseConfig {
    username: string;
    password: string;
    database: string;
    hostname: string;
    port: number;
    socketAddress: string
}
