package cr.go.ice.aia.installer.filter;

import cr.go.ice.aia.installer.service.ConfigService;
import cr.go.ice.aia.installer.util.JwtUtil;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * JWT authentication filter for /api/* endpoints.
 * Allows /api/auth/login without token.
 * Initializes ConfigService on first request.
 */
public class AuthFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        String configFile = filterConfig.getServletContext().getInitParameter("configFilePath");
        if (configFile == null) configFile = "aiaice-config.json";
        ConfigService.getInstance().init(configFile);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setStatus(200);
            return;
        }

        String path = req.getPathInfo() != null ? req.getPathInfo() : req.getServletPath();

        // Allow login endpoint without token
        if (path.endsWith("/auth/login") || path.endsWith("/auth/logout") || path.endsWith("/health")) {
            chain.doFilter(request, response);
            return;
        }

        // Check Bearer token
        String authHeader = req.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendError(res, 401, "Token requerido");
            return;
        }

        String token = authHeader.substring(7);
        try {
            JwtUtil.validateToken(token);
            chain.doFilter(request, response);
        } catch (Exception e) {
            sendError(res, 401, "Token inválido o expirado");
        }
    }

    @Override
    public void destroy() {}

    private void sendError(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
