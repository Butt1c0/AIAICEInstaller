package cr.go.ice.aia.installer.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

public class JwtUtil {

    private static final String SECRET = System.getProperty("aiaice.jwt.secret",
            "AIAICEInstaller-SecretKey-2024-MinLength32Bytes!");
    private static final SecretKey KEY = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    private static final long EXPIRATION_MS = 8 * 60 * 60 * 1000; // 8 hours

    private JwtUtil() {}

    public static String generateToken(String username, String envId) {
        return Jwts.builder()
                .setSubject(username)
                .claim("role", "admin")
                .claim("envId", envId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_MS))
                .signWith(KEY, SignatureAlgorithm.HS256)
                .compact();
    }

    public static Claims validateToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(KEY)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public static String getUsername(String token) {
        return validateToken(token).getSubject();
    }
}
