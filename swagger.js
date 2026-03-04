const path = require("path");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: { title: "Servana IT Web API", version: "1.0.0" },
    servers: [{ url: `http://localhost:${process.env.PORT}` }],
  },
  apis: ["./swaggerdocs/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        filter: true,
        docExpansion: "list",
      },
      customJsStr: `
        window.addEventListener('load', function () {
          const observer = new MutationObserver(function () {
            const filterInput = document.querySelector('.operation-filter-input');
            if (filterInput && !document.querySelector('#custom-filter-label')) {
              filterInput.placeholder = 'Search correct Tag Name here...';

              const label = document.createElement('label');
              label.id = 'custom-filter-label';
              label.style.display = 'block';
              label.style.marginBottom = '-15px';
              label.style.color = '#666';
              label.style.fontSize = '14px';
              label.innerHTML = 'Tag names are <strong>CASE-SENSITIVE</strong>, type the exact format of every tag name you want to search, oki?:';

              filterInput.parentNode.insertBefore(label, filterInput);
              observer.disconnect();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        });
      `,
    }),
  );
};

module.exports = setupSwagger;
